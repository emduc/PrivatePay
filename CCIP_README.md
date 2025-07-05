# PrivatePay CCIP Implementation

This implementation adds Chainlink CCIP (Cross-Chain Interoperability Protocol) support to PrivatePay, allowing cross-chain token transfers using native gas payments.

## Overview

The implementation includes both Circle CCTP and Chainlink CCIP protocols, giving users the choice between:

- **Circle CCTP**: For USDC transfers with attestation-based finality
- **Chainlink CCIP**: For broader token support with native gas payments

## Key Features

### CCIP Integration
- **Multi-chain support**: Ethereum Sepolia, Avalanche Fuji, Base Sepolia, Arbitrum Sepolia, Polygon Amoy
- **Token support**: USDC and CCIP-BnM test tokens
- **Native gas payments**: Pay CCIP fees in ETH, AVAX, etc. (no LINK required)
- **Real-time tracking**: CCIP Explorer integration for transaction monitoring
- **Automated contract management**: Pre-deployed TokenTransferor contracts

### User Experience
- **Protocol selection**: Choose between CCIP and CCTP
- **Token type selection**: USDC or CCIP-BnM for CCIP transfers
- **Status tracking**: Real-time progress updates with detailed logs
- **Message ID tracking**: Direct links to CCIP Explorer for transaction status

## Architecture

### Smart Contracts

#### TokenTransferor.sol
Based on Chainlink's official example, this contract handles:
- Cross-chain token transfers via CCIP
- Native gas fee payments
- Destination chain allowlisting
- Owner-only access control

### Frontend Components

#### CCIP Hook (`useCCIPTransfer.ts`)
- Token approval management
- CCIP fee estimation
- Cross-chain transfer execution
- Transaction confirmation tracking

#### Updated UI (`App.tsx`)
- Protocol selection dropdown
- Token type selection
- Enhanced status displays
- CCIP Explorer integration

## Setup Instructions

### 1. Deploy TokenTransferor Contracts

The TokenTransferor contract needs to be deployed once on each supported chain:

```typescript
// Compile the contract first using Remix, Hardhat, or Foundry
// Then update the bytecode in deploy-ccip-contract.ts

import { deployToAllChains } from './src/scripts/deploy-ccip-contract';

const contracts = await deployToAllChains("your_private_key");
```

### 2. Update Contract Addresses

After deployment, update `TOKEN_TRANSFEROR_ADDRESSES` in `src/lib/ccipChains.ts`:

```typescript
export const TOKEN_TRANSFEROR_ADDRESSES: Record<number, string> = {
  [CCIPSupportedChainId.ETH_SEPOLIA]: "0xYourDeployedAddress",
  [CCIPSupportedChainId.AVAX_FUJI]: "0xYourDeployedAddress",
  // ... etc
};
```

### 3. Fund Contracts with Test Tokens

Get test tokens from faucets and fund your deployed contracts:

```typescript
import { fundContractWithTokens, checkAllContractBalances } from './src/scripts/fund-ccip-tokens';

// Fund with CCIP-BnM tokens
await fundContractWithTokens(
  "your_private_key",
  CCIPSupportedChainId.AVAX_FUJI,
  "CCIP-BnM",
  "100"
);

// Check balances
await checkAllContractBalances();
```

### 4. Allowlist Destination Chains

Each contract needs to allowlist destination chains for security:

```typescript
import { allowlistDestinationChains } from './src/scripts/deploy-ccip-contract';

await allowlistDestinationChains(
  "your_private_key",
  "contract_address",
  CCIPSupportedChainId.AVAX_FUJI,
  [CCIPSupportedChainId.ETH_SEPOLIA, CCIPSupportedChainId.BASE_SEPOLIA]
);
```

## Faucet Links

### Ethereum Sepolia
- **ETH**: https://sepoliafaucet.com/
- **LINK**: https://faucets.chain.link/
- **CCIP-BnM**: https://faucets.chain.link/

### Avalanche Fuji
- **AVAX**: https://core.app/tools/testnet-faucet/
- **LINK**: https://faucets.chain.link/
- **CCIP-BnM**: https://faucets.chain.link/

### Base Sepolia
- **ETH**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **LINK**: https://faucets.chain.link/
- **CCIP-BnM**: https://faucets.chain.link/

### Arbitrum Sepolia
- **ETH**: https://sepoliafaucet.com/
- **LINK**: https://faucets.chain.link/
- **CCIP-BnM**: https://faucets.chain.link/

### Polygon Amoy
- **MATIC**: https://faucet.polygon.technology/
- **LINK**: https://faucets.chain.link/
- **CCIP-BnM**: https://faucets.chain.link/

## Usage

1. **Select Protocol**: Choose "Chainlink CCIP" from the protocol dropdown
2. **Select Token**: Choose "USDC" or "CCIP-BnM (Test Token)"
3. **Enter Details**: Destination address, amount, and destination chain
4. **Review & Confirm**: Check the payment overview
5. **Execute Transfer**: The app will handle approval, fee estimation, and transfer
6. **Track Progress**: Monitor status and use the CCIP Explorer link when available

## Transaction Flow

### CCIP Transfer Process
1. **Token Approval**: Approve TokenTransferor to spend tokens
2. **Fee Estimation**: Calculate CCIP fees for the transfer
3. **Balance Check**: Ensure sufficient native tokens for gas
4. **Transfer Execution**: Call `transferTokensPayNative` on the contract
5. **Confirmation**: Wait for transaction confirmation
6. **Message Tracking**: Extract CCIP message ID for explorer tracking

## Security Considerations

- **Owner-only transfers**: Only the contract owner can initiate transfers
- **Destination allowlisting**: Prevents transfers to non-allowlisted chains
- **Address validation**: Prevents transfers to zero address
- **Balance checks**: Ensures sufficient funds before transfer attempts

## Development Notes

- **Test Environment**: All configurations are for testnets only
- **Gas Optimization**: Uses native gas instead of LINK for lower costs
- **Error Handling**: Comprehensive error messages and retry logic
- **Type Safety**: Full TypeScript support with proper type definitions

## Monitoring

Use the CCIP Explorer to monitor cross-chain transfers:
- Transaction status and confirmations
- Fee breakdown and payment details
- Delivery confirmation on destination chain
- Complete transfer timeline

## Troubleshooting

### Common Issues

1. **Contract not deployed**: Ensure TokenTransferor is deployed on the source chain
2. **Insufficient balance**: Check native token balance for gas fees
3. **Chain not allowlisted**: Verify destination chain is allowlisted
4. **Token approval failed**: Ensure sufficient token balance

### Debug Steps

1. Check contract balances using `checkAllContractBalances()`
2. Verify chain allowlist status
3. Monitor transaction status on block explorers
4. Use CCIP Explorer for cross-chain transaction tracking

## Future Enhancements

- **Dynamic fee estimation**: Real-time fee updates based on network conditions
- **Multi-token transfers**: Support for transferring multiple tokens in one transaction
- **Advanced routing**: Automatic best-route selection for multi-hop transfers
- **Gas optimization**: Dynamic gas limit calculation based on destination requirements