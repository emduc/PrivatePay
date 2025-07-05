import { createWalletClient, http, createPublicClient, encodeFunctionData } from "viem";
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
  CCIP_ROUTER_ADDRESSES,
  LINK_TOKEN_ADDRESSES,
  CCIP_CHAIN_SELECTORS,
} from "../lib/ccipChains";

// TokenTransferor bytecode - this would need to be compiled first
// For now, this is a placeholder. In practice, you'd compile the contract first.
const TOKEN_TRANSFEROR_BYTECODE = "0x608060405234801561001057600080fd5b50..."; // Placeholder

const chains = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: sepolia,
  [CCIPSupportedChainId.AVAX_FUJI]: avalancheFuji,
  [CCIPSupportedChainId.BASE_SEPOLIA]: baseSepolia,
  [CCIPSupportedChainId.ARB_SEPOLIA]: arbitrumSepolia,
  [CCIPSupportedChainId.POLYGON_AMOY]: polygonAmoy,
};

export async function deployTokenTransferor(
  privateKey: string,
  chainId: CCIPSupportedChainId
): Promise<string> {
  const account = privateKeyToAccount(`0x${privateKey}`);
  
  const client = createWalletClient({
    chain: chains[chainId],
    transport: http(),
    account,
  });

  const publicClient = createPublicClient({
    chain: chains[chainId],
    transport: http(),
  });

  console.log(`Deploying TokenTransferor on ${chains[chainId].name}...`);
  console.log(`Router: ${CCIP_ROUTER_ADDRESSES[chainId]}`);
  console.log(`LINK: ${LINK_TOKEN_ADDRESSES[chainId]}`);

  try {
    // Deploy the contract
    const hash = await client.deployContract({
      abi: [
        {
          type: "constructor",
          inputs: [
            { name: "_router", type: "address" },
            { name: "_link", type: "address" },
          ],
        },
      ],
      bytecode: TOKEN_TRANSFEROR_BYTECODE as `0x${string}`,
      args: [
        CCIP_ROUTER_ADDRESSES[chainId] as `0x${string}`,
        LINK_TOKEN_ADDRESSES[chainId] as `0x${string}`,
      ],
    });

    console.log(`Deploy transaction hash: ${hash}`);

    // Wait for deployment confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (!receipt.contractAddress) {
      throw new Error("Contract deployment failed - no contract address returned");
    }

    console.log(`Contract deployed to: ${receipt.contractAddress}`);
    return receipt.contractAddress;
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

export async function allowlistDestinationChains(
  privateKey: string,
  contractAddress: string,
  chainId: CCIPSupportedChainId,
  destinationChains: CCIPSupportedChainId[]
): Promise<void> {
  const account = privateKeyToAccount(`0x${privateKey}`);
  
  const client = createWalletClient({
    chain: chains[chainId],
    transport: http(),
    account,
  });

  console.log(`Allowlisting destination chains for contract ${contractAddress}...`);

  for (const destChain of destinationChains) {
    if (destChain === chainId) continue; // Skip self

    const chainSelector = CCIP_CHAIN_SELECTORS[destChain];
    console.log(`Allowlisting ${chains[destChain].name} (selector: ${chainSelector})`);

    try {
      const hash = await client.sendTransaction({
        to: contractAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "allowlistDestinationChain",
              inputs: [
                { name: "_destinationChainSelector", type: "uint64" },
                { name: "allowed", type: "bool" },
              ],
            },
          ],
          functionName: "allowlistDestinationChain",
          args: [BigInt(chainSelector), true],
        }),
      });

      console.log(`Allowlist transaction hash: ${hash}`);
    } catch (error) {
      console.error(`Failed to allowlist ${chains[destChain].name}:`, error);
    }
  }

  console.log("Destination chain allowlisting completed");
}

// Example usage script
export async function deployToAllChains(privateKey: string): Promise<Record<number, string>> {
  const deployedContracts: Record<number, string> = {};
  
  const chainsToDeployTo = [
    CCIPSupportedChainId.ETH_SEPOLIA,
    CCIPSupportedChainId.AVAX_FUJI,
    CCIPSupportedChainId.BASE_SEPOLIA,
    CCIPSupportedChainId.ARB_SEPOLIA,
    CCIPSupportedChainId.POLYGON_AMOY,
  ];

  // Deploy to each chain
  for (const chainId of chainsToDeployTo) {
    try {
      const contractAddress = await deployTokenTransferor(privateKey, chainId);
      deployedContracts[chainId] = contractAddress;
      
      // Wait a bit between deployments
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`Failed to deploy to ${chains[chainId].name}:`, error);
    }
  }

  // Allowlist destination chains on each deployed contract
  for (const [chainId, contractAddress] of Object.entries(deployedContracts)) {
    const chain = parseInt(chainId) as CCIPSupportedChainId;
    const otherChains = chainsToDeployTo.filter(c => c !== chain);
    
    try {
      await allowlistDestinationChains(privateKey, contractAddress, chain, otherChains);
      
      // Wait a bit between allowlist operations
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Failed to allowlist destinations for ${chains[chain].name}:`, error);
    }
  }

  console.log("Deployment Summary:");
  for (const [chainId, address] of Object.entries(deployedContracts)) {
    console.log(`${chains[parseInt(chainId) as CCIPSupportedChainId].name}: ${address}`);
  }

  return deployedContracts;
}

// Manual deployment instructions
export const DEPLOYMENT_INSTRUCTIONS = `
CCIP TokenTransferor Deployment Instructions:

1. Compile the TokenTransferor.sol contract using Remix, Hardhat, or Foundry
2. Get the bytecode from the compilation output
3. Replace TOKEN_TRANSFEROR_BYTECODE in this file with the actual bytecode
4. Run the deployment script with your private key:

   const contracts = await deployToAllChains("your_private_key_here");

5. Update TOKEN_TRANSFEROR_ADDRESSES in ccipChains.ts with the deployed addresses

Required for each chain:
- Native tokens for gas fees (ETH, AVAX, etc.)
- CCIP-BnM or USDC tokens to test transfers

Note: This is a test implementation. Use proper security practices for production.
`;

console.log(DEPLOYMENT_INSTRUCTIONS);