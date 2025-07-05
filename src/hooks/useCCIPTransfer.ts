"use client";

import { useState } from "react";
import {
  createWalletClient,
  http,
  encodeFunctionData,
  HttpTransport,
  type Chain,
  type Account,
  type WalletClient,
  parseUnits,
  createPublicClient,
  formatUnits,
  parseEther,
} from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import {
  sepolia,
  avalancheFuji,
  baseSepolia,
  arbitrumSepolia,
  polygonAmoy,
} from "viem/chains";
import { defineChain } from "viem";
import {
  CCIPSupportedChainId,
  CCIP_CHAIN_SELECTORS,
  CCIP_ROUTER_ADDRESSES,
  CCIP_BNM_ADDRESSES,
  CCIP_USDC_ADDRESSES,
  TOKEN_TRANSFEROR_ADDRESSES,
} from "../lib/ccipChains";

export type CCIPTransferStep =
  | "idle"
  | "approving-token"
  | "estimating-fees"
  | "transferring"
  | "waiting-confirmation"
  | "completed"
  | "error";

// Define Ronin Saigon chain
const roninSaigon = defineChain({
  id: 2021,
  name: 'Ronin Saigon',
  nativeCurrency: {
    decimals: 18,
    name: 'RON',
    symbol: 'RON',
  },
  rpcUrls: {
    default: {
      http: ['https://saigon-testnet.roninchain.com/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://saigon-app.roninchain.com' },
  },
});

const chains = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: sepolia,
  [CCIPSupportedChainId.AVAX_FUJI]: avalancheFuji,
  [CCIPSupportedChainId.BASE_SEPOLIA]: baseSepolia,
  [CCIPSupportedChainId.ARB_SEPOLIA]: arbitrumSepolia,
  [CCIPSupportedChainId.POLYGON_AMOY]: polygonAmoy,
  [CCIPSupportedChainId.RONIN_SAIGON]: roninSaigon,
};

export function useCCIPTransfer() {
  const [currentStep, setCurrentStep] = useState<CCIPTransferStep>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);

  const DEFAULT_DECIMALS = 6; // For USDC
  const BNM_DECIMALS = 18; // For CCIP-BnM

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

  const getPublicClient = (chainId: CCIPSupportedChainId) => {
    return createPublicClient({
      chain: chains[chainId],
      transport: http(),
    });
  };

  const getClients = (privateKey: string, chainId: CCIPSupportedChainId) => {
    const account = privateKeyToAccount(`0x${privateKey}`, { nonceManager });

    return createWalletClient({
      chain: chains[chainId],
      transport: http(),
      account,
    });
  };

  const getTokenBalance = async (
    privateKey: string,
    chainId: CCIPSupportedChainId,
    tokenType: "USDC" | "CCIP-BnM" = "USDC"
  ) => {
    const publicClient = getPublicClient(chainId);
    const account = privateKeyToAccount(`0x${privateKey}`, { nonceManager });

    const tokenAddress = tokenType === "USDC" 
      ? CCIP_USDC_ADDRESSES[chainId] 
      : CCIP_BNM_ADDRESSES[chainId];
    
    const decimals = tokenType === "USDC" ? DEFAULT_DECIMALS : BNM_DECIMALS;

    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: [account.address],
    });

    const formattedBalance = formatUnits(balance, decimals);
    return formattedBalance;
  };

  const approveToken = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: CCIPSupportedChainId,
    amount: bigint,
    tokenType: "USDC" | "CCIP-BnM" = "USDC"
  ) => {
    setCurrentStep("approving-token");
    addLog(`Approving ${tokenType} transfer...`);

    try {
      const tokenAddress = tokenType === "USDC" 
        ? CCIP_USDC_ADDRESSES[sourceChainId] 
        : CCIP_BNM_ADDRESSES[sourceChainId];
      
      const spenderAddress = TOKEN_TRANSFEROR_ADDRESSES[sourceChainId];

      const tx = await client.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "approve",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
          ],
          functionName: "approve",
          args: [spenderAddress as `0x${string}`, amount],
        }),
      });

      addLog(`${tokenType} Approval Tx: ${tx}`);
      return tx;
    } catch (err) {
      setError("Token approval failed");
      throw err;
    }
  };

  const estimateCCIPFees = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: CCIPSupportedChainId,
    destinationChainId: CCIPSupportedChainId,
    receiver: string,
    amount: bigint,
    tokenType: "USDC" | "CCIP-BnM" = "USDC"
  ) => {
    setCurrentStep("estimating-fees");
    addLog("Estimating CCIP fees...");

    try {
      const destinationSelector = CCIP_CHAIN_SELECTORS[destinationChainId];
      const tokenAddress = tokenType === "USDC" 
        ? CCIP_USDC_ADDRESSES[sourceChainId] 
        : CCIP_BNM_ADDRESSES[sourceChainId];

      // Build CCIP message structure for fee estimation
      const publicClient = getPublicClient(sourceChainId);
      
      // Call the router's getFee function through our contract
      const fees = await publicClient.readContract({
        address: CCIP_ROUTER_ADDRESSES[sourceChainId] as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "getFee",
            stateMutability: "view",
            inputs: [
              { name: "destinationChainSelector", type: "uint64" },
              { name: "message", type: "tuple", components: [
                { name: "receiver", type: "bytes" },
                { name: "data", type: "bytes" },
                { name: "tokenAmounts", type: "tuple[]", components: [
                  { name: "token", type: "address" },
                  { name: "amount", type: "uint256" }
                ]},
                { name: "extraArgs", type: "bytes" },
                { name: "feeToken", type: "address" }
              ]}
            ],
            outputs: [{ name: "fee", type: "uint256" }],
          },
        ],
        functionName: "getFee",
        args: [
          BigInt(destinationSelector),
          {
            receiver: `0x${receiver.slice(2).padStart(64, '0')}`, // ABI encode receiver
            data: "0x",
            tokenAmounts: [{
              token: tokenAddress as `0x${string}`,
              amount: amount
            }],
            extraArgs: "0x97a657c90000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001", // Default extraArgs
            feeToken: "0x0000000000000000000000000000000000000000" // Native gas
          }
        ],
      });

      addLog(`Estimated CCIP fees: ${formatUnits(fees, 18)} ETH`);
      return fees;
    } catch (err) {
      setError("Fee estimation failed");
      throw err;
    }
  };

  const transferTokensViaCCIP = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: CCIPSupportedChainId,
    destinationChainId: CCIPSupportedChainId,
    receiver: string,
    amount: bigint,
    fees: bigint,
    tokenType: "USDC" | "CCIP-BnM" = "USDC"
  ) => {
    setCurrentStep("transferring");
    addLog("Initiating CCIP transfer...");

    try {
      const transferorAddress = TOKEN_TRANSFEROR_ADDRESSES[sourceChainId];
      const destinationSelector = CCIP_CHAIN_SELECTORS[destinationChainId];
      const tokenAddress = tokenType === "USDC" 
        ? CCIP_USDC_ADDRESSES[sourceChainId] 
        : CCIP_BNM_ADDRESSES[sourceChainId];

      // Call transferTokensPayNative function on our deployed contract
      const tx = await client.sendTransaction({
        to: transferorAddress as `0x${string}`,
        value: fees, // Pay fees in native gas
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "transferTokensPayNative",
              stateMutability: "payable",
              inputs: [
                { name: "_destinationChainSelector", type: "uint64" },
                { name: "_receiver", type: "address" },
                { name: "_token", type: "address" },
                { name: "_amount", type: "uint256" },
              ],
              outputs: [{ name: "messageId", type: "bytes32" }],
            },
          ],
          functionName: "transferTokensPayNative",
          args: [
            BigInt(destinationSelector),
            receiver as `0x${string}`,
            tokenAddress as `0x${string}`,
            amount,
          ],
        }),
      });

      addLog(`CCIP Transfer Tx: ${tx}`);
      return tx;
    } catch (err) {
      setError("CCIP transfer failed");
      throw err;
    }
  };

  const waitForConfirmation = async (
    txHash: string,
    sourceChainId: CCIPSupportedChainId
  ) => {
    setCurrentStep("waiting-confirmation");
    addLog("Waiting for transaction confirmation...");

    try {
      const publicClient = getPublicClient(sourceChainId);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      addLog("Transaction confirmed!");
      
      // Extract messageId from logs if available
      if (receipt.logs && receipt.logs.length > 0) {
        // Look for TokensTransferred event
        const transferEvent = receipt.logs.find(log => 
          log.topics[0] === "0x17c4de02e47b97f9e8cd5e6c7f8a96baac54e87edfeb1fce426b4d44c4b3f1c5" // TokensTransferred event signature
        );
        
        if (transferEvent && transferEvent.topics[1]) {
          setMessageId(transferEvent.topics[1]);
          addLog(`CCIP Message ID: ${transferEvent.topics[1]}`);
        }
      }

      setCurrentStep("completed");
      return receipt;
    } catch (err) {
      setError("Transaction confirmation failed");
      throw err;
    }
  };

  const executeCCIPTransfer = async (
    privateKey: string,
    sourceChainId: CCIPSupportedChainId,
    destinationChainId: CCIPSupportedChainId,
    receiver: string,
    amount: string,
    tokenType: "USDC" | "CCIP-BnM" = "USDC"
  ) => {
    try {
      setError(null);
      setMessageId(null);
      
      const decimals = tokenType === "USDC" ? DEFAULT_DECIMALS : BNM_DECIMALS;
      const numericAmount = parseUnits(amount, decimals);
      const sourceClient = getClients(privateKey, sourceChainId);

      // Check native balance for gas fees
      const publicClient = getPublicClient(sourceChainId);
      const nativeBalance = await publicClient.getBalance({
        address: sourceClient.account.address,
      });
      
      const minBalance = parseEther("0.01"); // 0.01 native token
      if (nativeBalance < minBalance) {
        throw new Error("Insufficient native token for gas fees");
      }

      // Step 1: Approve token spending
      await approveToken(sourceClient, sourceChainId, numericAmount, tokenType);

      // Step 2: Estimate CCIP fees
      const fees = await estimateCCIPFees(
        sourceClient,
        sourceChainId,
        destinationChainId,
        receiver,
        numericAmount,
        tokenType
      );

      // Check if we have enough native tokens to pay fees
      if (nativeBalance < fees) {
        throw new Error(`Insufficient native tokens for CCIP fees. Need ${formatUnits(fees, 18)} ETH`);
      }

      // Step 3: Execute CCIP transfer
      const txHash = await transferTokensViaCCIP(
        sourceClient,
        sourceChainId,
        destinationChainId,
        receiver,
        numericAmount,
        fees,
        tokenType
      );

      // Step 4: Wait for confirmation
      await waitForConfirmation(txHash, sourceChainId);

      addLog("CCIP transfer completed successfully!");
      addLog("Check CCIP Explorer for cross-chain transaction status.");

    } catch (error) {
      setCurrentStep("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
    }
  };

  const reset = () => {
    setCurrentStep("idle");
    setLogs([]);
    setError(null);
    setMessageId(null);
  };

  return {
    currentStep,
    logs,
    error,
    messageId,
    executeCCIPTransfer,
    getTokenBalance,
    reset,
  };
}