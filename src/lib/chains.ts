export enum SupportedChainId {
  ETH_SEPOLIA = 11155111,
  AVAX_FUJI = 43113,
  BASE_SEPOLIA = 84532,
  ARB_SEPOLIA = 421614,
  SONIC_BLAZE = 57054,
}

// CCTP v2 contract addresses (same on all chains)
const MESSAGE_V2_ADDRESS = "0xbaC0179bB358A8936169a63408C8481D582390C4";
const TOKEN_MINTER_V2_ADDRESS = "0xb43db544E2c27092c107639Ad201b3dEfAbcF192";
const MESSAGE_TRANSMITTER_V2_ADDRESS = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
const TOKEN_MESSENGER_V2_ADDRESS = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";

// USDC contract addresses on each chain
export const CHAIN_IDS_TO_USDC_ADDRESSES: Record<number, string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [SupportedChainId.AVAX_FUJI]: "0x5425890298aed601595a70AB815c96711a31Bc65",
  [SupportedChainId.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [SupportedChainId.ARB_SEPOLIA]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [SupportedChainId.SONIC_BLAZE]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Assuming same as ARB for now
};

export const CHAIN_IDS_TO_TOKEN_MESSENGER: Record<number, string> = {
  [SupportedChainId.ETH_SEPOLIA]: TOKEN_MESSENGER_V2_ADDRESS,
  [SupportedChainId.AVAX_FUJI]: TOKEN_MESSENGER_V2_ADDRESS,
  [SupportedChainId.BASE_SEPOLIA]: TOKEN_MESSENGER_V2_ADDRESS,
  [SupportedChainId.ARB_SEPOLIA]: TOKEN_MESSENGER_V2_ADDRESS,
  [SupportedChainId.SONIC_BLAZE]: TOKEN_MESSENGER_V2_ADDRESS,
};

export const CHAIN_IDS_TO_MESSAGE_TRANSMITTER: Record<number, string> = {
  [SupportedChainId.ETH_SEPOLIA]: MESSAGE_TRANSMITTER_V2_ADDRESS,
  [SupportedChainId.AVAX_FUJI]: MESSAGE_TRANSMITTER_V2_ADDRESS,
  [SupportedChainId.BASE_SEPOLIA]: MESSAGE_TRANSMITTER_V2_ADDRESS,
  [SupportedChainId.ARB_SEPOLIA]: MESSAGE_TRANSMITTER_V2_ADDRESS,
  [SupportedChainId.SONIC_BLAZE]: MESSAGE_TRANSMITTER_V2_ADDRESS,
};

export const DESTINATION_DOMAINS: Record<number, number> = {
  [SupportedChainId.ETH_SEPOLIA]: 0,
  [SupportedChainId.AVAX_FUJI]: 1,
  [SupportedChainId.BASE_SEPOLIA]: 6,
  [SupportedChainId.ARB_SEPOLIA]: 3,
  [SupportedChainId.SONIC_BLAZE]: 57054,
};

export const CHAIN_ID_TO_NAME: Record<number, string> = {
  [SupportedChainId.ETH_SEPOLIA]: "Ethereum Sepolia",
  [SupportedChainId.AVAX_FUJI]: "Avalanche Fuji",
  [SupportedChainId.BASE_SEPOLIA]: "Base Sepolia",
  [SupportedChainId.ARB_SEPOLIA]: "Arbitrum Sepolia",
  [SupportedChainId.SONIC_BLAZE]: "Sonic Blaze",
};