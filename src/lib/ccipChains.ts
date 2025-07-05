export enum CCIPSupportedChainId {
  ETH_SEPOLIA = 11155111,
  AVAX_FUJI = 43113,
  BASE_SEPOLIA = 84532,
  ARB_SEPOLIA = 421614,
  POLYGON_AMOY = 80002,
  RONIN_SAIGON = 2021,
}

// CCIP Chain Selectors
export const CCIP_CHAIN_SELECTORS: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "16015286601757825753",
  [CCIPSupportedChainId.AVAX_FUJI]: "14767482510784806043",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "10344971235874465080",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "3478487238524512106",
  [CCIPSupportedChainId.POLYGON_AMOY]: "16281711391670634445",
  [CCIPSupportedChainId.RONIN_SAIGON]: "13116810400804392105",
};

// CCIP Router addresses for each chain
export const CCIP_ROUTER_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  [CCIPSupportedChainId.AVAX_FUJI]: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
  [CCIPSupportedChainId.POLYGON_AMOY]: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2",
  [CCIPSupportedChainId.RONIN_SAIGON]: "0x5C28C0C131ceD969FF8eacbc4a35B82C74CD7bb4", // Ronin Saigon CCIP Router
};

// LINK token addresses for each chain
export const LINK_TOKEN_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  [CCIPSupportedChainId.AVAX_FUJI]: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
  [CCIPSupportedChainId.POLYGON_AMOY]: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
  [CCIPSupportedChainId.RONIN_SAIGON]: "0x5bA85F96571A7Df5F2abE89A86d9b3daa7142b5a", // Ronin Saigon LINK token
};

// CCIP-BnM token addresses (test token for cross-chain transfers)
export const CCIP_BNM_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05",
  [CCIPSupportedChainId.AVAX_FUJI]: "0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "0x88A2d74F47a237a62e7A51cdDa67270CE381555e",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "0xA8C0c11bf64AF62CDCA6f93D3769B88BdD7cb93D",
  [CCIPSupportedChainId.POLYGON_AMOY]: "0xcab0EF91Bee323d1A617c0a027eE753aFd6997E4",
  [CCIPSupportedChainId.RONIN_SAIGON]: "0x1a5DB8aC65c7AE4b1BFD3b8cf9A40dF1dce3E33a", // Ronin Saigon CCIP-BnM
};

// USDC token addresses on each chain (if we want to use USDC instead of CCIP-BnM)
export const CCIP_USDC_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [CCIPSupportedChainId.AVAX_FUJI]: "0x5425890298aed601595a70AB815c96711a31Bc65",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [CCIPSupportedChainId.POLYGON_AMOY]: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  [CCIPSupportedChainId.RONIN_SAIGON]: "0x067ea5b8De1D80d8C73E57A23048a11b0Cd8bbfd", // Ronin Saigon USDC
};

export const CCIP_CHAIN_ID_TO_NAME: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "Ethereum Sepolia",
  [CCIPSupportedChainId.AVAX_FUJI]: "Avalanche Fuji",
  [CCIPSupportedChainId.BASE_SEPOLIA]: "Base Sepolia",
  [CCIPSupportedChainId.ARB_SEPOLIA]: "Arbitrum Sepolia",
  [CCIPSupportedChainId.POLYGON_AMOY]: "Polygon Amoy",
  [CCIPSupportedChainId.RONIN_SAIGON]: "Ronin Saigon",
};

// TokenTransferor contract addresses 
export const TOKEN_TRANSFEROR_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0x25B958a21A0204CD56B75e243098F74e589a0C83", 
};