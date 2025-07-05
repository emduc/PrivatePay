import { createWalletClient, http, createPublicClient, encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  sepolia,
  avalancheFuji,
  baseSepolia,
  arbitrumSepolia,
  polygonAmoy,
} from "viem/chains";
import {
  CCIPSupportedChainId,
  CCIP_BNM_ADDRESSES,
  CCIP_USDC_ADDRESSES,
  LINK_TOKEN_ADDRESSES,
  TOKEN_TRANSFEROR_ADDRESSES,
} from "../lib/ccipChains";

const chains = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: sepolia,
  [CCIPSupportedChainId.AVAX_FUJI]: avalancheFuji,
  [CCIPSupportedChainId.BASE_SEPOLIA]: baseSepolia,
  [CCIPSupportedChainId.ARB_SEPOLIA]: arbitrumSepolia,
  [CCIPSupportedChainId.POLYGON_AMOY]: polygonAmoy,
};

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
];

export async function getTokenBalance(
  chainId: CCIPSupportedChainId,
  tokenAddress: string,
  accountAddress: string
): Promise<{ balance: string; decimals: number }> {
  const publicClient = createPublicClient({
    chain: chains[chainId],
    transport: http(),
  });

  try {
    const [balance, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }),
    ]);

    return {
      balance: (balance as bigint).toString(),
      decimals: decimals as number,
    };
  } catch (error) {
    console.error("Error getting token balance:", error);
    throw error;
  }
}

export async function fundContractWithTokens(
  privateKey: string,
  chainId: CCIPSupportedChainId,
  tokenType: "USDC" | "CCIP-BnM" | "LINK",
  amount: string
): Promise<string> {
  const account = privateKeyToAccount(`0x${privateKey}`);
  
  const client = createWalletClient({
    chain: chains[chainId],
    transport: http(),
    account,
  });

  const contractAddress = TOKEN_TRANSFEROR_ADDRESSES[chainId];
  if (contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`TokenTransferor contract not deployed on ${chains[chainId].name}`);
  }

  let tokenAddress: string;
  let decimals: number;

  switch (tokenType) {
    case "USDC":
      tokenAddress = CCIP_USDC_ADDRESSES[chainId];
      decimals = 6;
      break;
    case "CCIP-BnM":
      tokenAddress = CCIP_BNM_ADDRESSES[chainId];
      decimals = 18;
      break;
    case "LINK":
      tokenAddress = LINK_TOKEN_ADDRESSES[chainId];
      decimals = 18;
      break;
    default:
      throw new Error(`Unsupported token type: ${tokenType}`);
  }

  const tokenAmount = parseUnits(amount, decimals);

  console.log(`Funding contract ${contractAddress} with ${amount} ${tokenType} on ${chains[chainId].name}...`);

  try {
    const hash = await client.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [contractAddress as `0x${string}`, tokenAmount],
      }),
    });

    console.log(`Funding transaction hash: ${hash}`);
    return hash;
  } catch (error) {
    console.error("Funding failed:", error);
    throw error;
  }
}

export async function checkContractBalances(chainId: CCIPSupportedChainId): Promise<void> {
  const contractAddress = TOKEN_TRANSFEROR_ADDRESSES[chainId];
  if (contractAddress === "0x0000000000000000000000000000000000000000") {
    console.log(`TokenTransferor contract not deployed on ${chains[chainId].name}`);
    return;
  }

  console.log(`\nChecking balances for contract ${contractAddress} on ${chains[chainId].name}:`);

  try {
    // Check USDC balance
    const usdcBalance = await getTokenBalance(chainId, CCIP_USDC_ADDRESSES[chainId], contractAddress);
    const usdcFormatted = (BigInt(usdcBalance.balance) / BigInt(10 ** usdcBalance.decimals)).toString();
    console.log(`USDC: ${usdcFormatted}`);

    // Check CCIP-BnM balance
    const bnmBalance = await getTokenBalance(chainId, CCIP_BNM_ADDRESSES[chainId], contractAddress);
    const bnmFormatted = (BigInt(bnmBalance.balance) / BigInt(10 ** bnmBalance.decimals)).toString();
    console.log(`CCIP-BnM: ${bnmFormatted}`);

    // Check LINK balance
    const linkBalance = await getTokenBalance(chainId, LINK_TOKEN_ADDRESSES[chainId], contractAddress);
    const linkFormatted = (BigInt(linkBalance.balance) / BigInt(10 ** linkBalance.decimals)).toString();
    console.log(`LINK: ${linkFormatted}`);

    // Check native balance
    const publicClient = createPublicClient({
      chain: chains[chainId],
      transport: http(),
    });
    
    const nativeBalance = await publicClient.getBalance({
      address: contractAddress as `0x${string}`,
    });
    const nativeFormatted = (nativeBalance / BigInt(10 ** 18)).toString();
    console.log(`Native (${chains[chainId].nativeCurrency.symbol}): ${nativeFormatted}`);

  } catch (error) {
    console.error(`Error checking balances for ${chains[chainId].name}:`, error);
  }
}

export async function checkAllContractBalances(): Promise<void> {
  const allChains = [
    CCIPSupportedChainId.ETH_SEPOLIA,
    CCIPSupportedChainId.AVAX_FUJI,
    CCIPSupportedChainId.BASE_SEPOLIA,
    CCIPSupportedChainId.ARB_SEPOLIA,
    CCIPSupportedChainId.POLYGON_AMOY,
  ];

  for (const chainId of allChains) {
    await checkContractBalances(chainId);
  }
}

// Funding instructions and faucet links
export const FUNDING_INSTRUCTIONS = `
CCIP TokenTransferor Funding Instructions:

1. Get Test Tokens from Faucets:

   ETH Sepolia:
   - ETH: https://sepoliafaucet.com/
   - LINK: https://faucets.chain.link/
   - USDC: Circle Testnet Faucet
   - CCIP-BnM: https://faucets.chain.link/

   Avalanche Fuji:
   - AVAX: https://core.app/tools/testnet-faucet/
   - LINK: https://faucets.chain.link/
   - USDC: Circle Testnet Faucet
   - CCIP-BnM: https://faucets.chain.link/

   Base Sepolia:
   - ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
   - LINK: https://faucets.chain.link/
   - USDC: Circle Testnet Faucet
   - CCIP-BnM: https://faucets.chain.link/

   Arbitrum Sepolia:
   - ETH: https://sepoliafaucet.com/
   - LINK: https://faucets.chain.link/
   - USDC: Circle Testnet Faucet
   - CCIP-BnM: https://faucets.chain.link/

   Polygon Amoy:
   - MATIC: https://faucet.polygon.technology/
   - LINK: https://faucets.chain.link/
   - USDC: Circle Testnet Faucet
   - CCIP-BnM: https://faucets.chain.link/

2. Fund Your Deployed Contracts:

   // Example: Fund with 100 CCIP-BnM on Avalanche Fuji
   await fundContractWithTokens(
     "your_private_key",
     CCIPSupportedChainId.AVAX_FUJI,
     "CCIP-BnM",
     "100"
   );

3. Check Contract Balances:

   await checkAllContractBalances();

Recommended Amounts:
- CCIP-BnM: 100-1000 tokens per chain for testing
- USDC: 10-100 tokens per chain for testing  
- LINK: 50-200 tokens per chain for fee payments
- Native tokens: 0.1-1 for gas fees
`;

console.log(FUNDING_INSTRUCTIONS);