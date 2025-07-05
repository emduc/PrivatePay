import { ethers } from 'ethers';
import { POOL_CONTRACT_ADDRESS, POOL_ABI } from './lib/pool';

console.log('🚀🚀🚀 BACKGROUND SCRIPT STARTING 🚀🚀🚀');
console.log('Timestamp:', new Date().toISOString());
console.log('Ethers version:', ethers.version);

let masterWallet: ethers.HDNodeWallet | null = null;
let currentSessionWallet: ethers.HDNodeWallet | null = null;
let sessionCounter = 0;
let currentChainId = '0xaa36a7'; // Sepolia testnet
let currentNetworkVersion = '11155111';

// Address spoofing constants
const SPOOFED_ADDRESS = '0xA6a49d09321f701AB4295e5eB115E65EcF9b83B5';
let addressSpoofingEnabled = false;

// Transaction management
let pendingTransactions: Map<string, {
  txParams: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  processing?: boolean; // Add flag to prevent double processing
}> = new Map();

// Transaction progress tracking
let activeTransactionProgress: {
  txId: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'processing' | 'completed' | 'error';
  txHash?: string;
  error?: string;
} | null = null;

const updateTransactionProgress = (txId: string, currentStep: number, totalSteps: number, stepName: string, status: 'processing' | 'completed' | 'error', txHash?: string, error?: string) => {
  activeTransactionProgress = {
    txId,
    currentStep,
    totalSteps,
    stepName,
    status,
    txHash,
    error
  };
  console.log(`📊 Transaction Progress: ${currentStep}/${totalSteps} - ${stepName} (${status})`);
};

const clearTransactionProgress = () => {
  activeTransactionProgress = null;
  console.log('🧹 Transaction progress cleared');
};

const initializeMasterWallet = async () => {
  try {
    const result = await chrome.storage.local.get(['seedPhrase', 'sessionCounter', 'addressSpoofing']);
    if (result.seedPhrase) {
      masterWallet = ethers.HDNodeWallet.fromPhrase(result.seedPhrase);
      console.log('Master wallet initialized from seed phrase');
      
      // Load session counter and address spoofing setting
      sessionCounter = result.sessionCounter || 0;
      addressSpoofingEnabled = result.addressSpoofing || false;
      console.log('Address spoofing enabled:', addressSpoofingEnabled);
    }
  } catch (error) {
    console.error('Error initializing master wallet:', error);
  }
};

const generateFreshSessionWallet = async () => {
  if (!masterWallet) {
    console.error('No master wallet available');
    return null;
  }
  
  // Increment session counter for fresh address
  sessionCounter++;
  await chrome.storage.local.set({ sessionCounter });
  
  // Derive a new wallet using the session counter
  const derivationPath = `m/44'/60'/0'/0/${sessionCounter}`;
  currentSessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
  
  console.log(`Generated fresh session wallet #${sessionCounter}:`, currentSessionWallet.address);
  return currentSessionWallet;
};

console.log('🏗️ Initializing master wallet...');
initializeMasterWallet().then(() => {
  console.log('✅ Master wallet initialization completed');
}).catch((error) => {
  console.error('❌ Master wallet initialization failed:', error);
});

console.log('📡 Registering message listener...');
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('🎯🎯🎯 BACKGROUND MESSAGE RECEIVED 🎯🎯🎯');
  console.log('   Message type:', msg.type);
  console.log('   Full message:', msg);
  console.log('   Timestamp:', new Date().toISOString());
  
  (async () => {
    try {
      if (msg.type === 'connect') {
        if (!masterWallet) {
          sendResponse(null);
          return;
        }
        
        // Load current address spoofing setting
        const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
        addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
        
        // Generate fresh session wallet for each connection
        const sessionWallet = await generateFreshSessionWallet();
        if (sessionWallet) {
          // Return spoofed address if enabled, otherwise real address
          const addressToReturn = addressSpoofingEnabled ? SPOOFED_ADDRESS : sessionWallet.address;
          console.log(`🎭 Returning address to dApp: ${addressToReturn} (spoofing: ${addressSpoofingEnabled})`);
          sendResponse(addressToReturn);
        } else {
          sendResponse(null);
        }
      }
      
      if (msg.type === 'getAccounts') {
        if (currentSessionWallet) {
          // Load current address spoofing setting
          const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
          addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
          
          // Return spoofed address if enabled, otherwise real address
          const addressToReturn = addressSpoofingEnabled ? SPOOFED_ADDRESS : currentSessionWallet.address;
          console.log(`🎭 getAccounts returning: ${addressToReturn} (spoofing: ${addressSpoofingEnabled})`);
          sendResponse(addressToReturn);
        } else {
          sendResponse(null);
        }
      }
      
      if (msg.type === 'personalSign') {
        if (!currentSessionWallet) {
          sendResponse({ error: 'No wallet connected' });
          return;
        }
        
        const { message } = msg;
        try {
          const signature = await currentSessionWallet.signMessage(message);
          sendResponse(signature);
        } catch (error) {
          sendResponse({ error: 'Failed to sign message' });
        }
      }
      
      if (msg.type === 'sendTransaction') {
        if (!currentSessionWallet) {
          sendResponse({ error: 'No wallet connected' });
          return;
        }
        
        let { txParams } = msg;
        const txId = Date.now().toString();
        
        console.log('🔥 TRANSACTION CONFIRMATION REQUIRED 🔥');
        console.log('Transaction ID:', txId);
        console.log('Original Transaction Params:', txParams);
        console.log('Formatted Transaction Details:', {
          to: txParams.to,
          value: txParams.value ? ethers.formatEther(txParams.value) + ' ETH' : '0 ETH',
          gasLimit: txParams.gasLimit,
          gasPrice: txParams.gasPrice,
          data: txParams.data || 'None',
          from: currentSessionWallet.address,
          dataLength: txParams.data ? txParams.data.length : 0,
          isContractCall: txParams.data && txParams.data !== '0x'
        });
        
        // Store pending transaction
        const pendingTx = new Promise((resolve, reject) => {
          pendingTransactions.set(txId, {
            txParams,
            resolve,
            reject,
            timestamp: Date.now()
          });
        });
        
        // Show browser notification
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon32.png',
            title: 'PrivatePay Transaction',
            message: `Open extension to confirm transaction`
          });
        } catch (e) {
          console.log('Notification permission not granted');
        }
        
        // Wait for user approval/rejection
        pendingTx.then((result) => {
          // Don't send response here anymore - we'll send it immediately when approved
        }).catch((error) => {
          // Don't send response here anymore - we'll send it immediately when approved
        });
        
        return true; // Keep message channel open for async response
      }
      
      if (msg.type === 'importWallet') {
        const { seedPhrase } = msg;
        try {
          // Validate seed phrase by creating wallet
          const testWallet = ethers.HDNodeWallet.fromPhrase(seedPhrase);
          
          // Store seed phrase instead of private key
          await chrome.storage.local.set({ 
            seedPhrase,
            sessionCounter: 0
          });
          
          // Initialize master wallet
          masterWallet = testWallet;
          sessionCounter = 0;
          currentSessionWallet = null;
          
          sendResponse({ 
            success: true, 
            masterAddress: testWallet.address,
            message: 'Seed phrase stored. Fresh addresses will be generated for each connection.'
          });
        } catch (error) {
          sendResponse({ error: 'Invalid seed phrase' });
        }
      }
      
      if (msg.type === 'getWalletInfo') {
        if (!masterWallet) {
          sendResponse({ error: 'No wallet imported' });
          return;
        }
        
        sendResponse({
          masterAddress: masterWallet.address,
          currentSessionAddress: currentSessionWallet?.address || null,
          sessionCount: sessionCounter
        });
      }
      
      if (msg.type === 'getChainId') {
        sendResponse(currentChainId);
      }
      
      if (msg.type === 'getNetworkVersion') {
        sendResponse(currentNetworkVersion);
      }
      
      if (msg.type === 'switchChain') {
        const { chainId } = msg;
        console.log('Background: Switching to chain:', chainId);
        
        // Accept any chain switch
        currentChainId = chainId;
        
        // Update network version based on chain
        if (chainId === '0x1') {
          currentNetworkVersion = '1';
        } else if (chainId === '0xaa36a7' || chainId === '0x11155111') {
          currentNetworkVersion = '11155111';
        } else {
          currentNetworkVersion = parseInt(chainId, 16).toString();
        }
        
        console.log('Chain switched to:', currentChainId, 'Network version:', currentNetworkVersion);
        sendResponse(null); // Success
      }
      
      if (msg.type === 'getBalance') {
        const { address } = msg;
        console.log('💰 Background: Balance requested for:', address);
        
        // Return fake balance - different amounts for different addresses
        if (currentSessionWallet && address?.toLowerCase() === currentSessionWallet.address.toLowerCase()) {
          // Current session wallet gets more balance
          const fakeBalance = '0x56bc75e2d630e0000'; // 100 ETH
          console.log('💎 Returning fake balance for session wallet:', fakeBalance);
          sendResponse(fakeBalance);
        } else {
          // Other addresses get less
          const fakeBalance = '0x8ac7230489e80000'; // 10 ETH
          console.log('💰 Returning fake balance for other address:', fakeBalance);
          sendResponse(fakeBalance);
        }
      }
      
      if (msg.type === 'getPendingTransactions') {
        const pending = Array.from(pendingTransactions.entries()).map(([id, tx]) => ({
          id,
          txParams: tx.txParams,
          timestamp: tx.timestamp,
          from: currentSessionWallet?.address
        }));
        sendResponse(pending);
      }
      
      if (msg.type === 'approveTransaction') {
        const { txId } = msg;
        console.log('🎯 APPROVE TRANSACTION CALLED');
        console.log('   Transaction ID:', txId);
        console.log('   Pending transactions count:', pendingTransactions.size);
        console.log('   Available transaction IDs:', Array.from(pendingTransactions.keys()));
        
        const pendingTx = pendingTransactions.get(txId);
        if (!pendingTx) {
          console.error('❌ Transaction not found in pending transactions!');
          sendResponse({ error: 'Transaction not found' });
          return;
        }
        
        // Check if already processing to prevent double-clicking
        if (pendingTx.processing) {
          console.log('⚠️ Transaction already being processed, ignoring duplicate approval');
          sendResponse({ error: 'Transaction already being processed' });
          return;
        }
        
        // Mark as processing
        pendingTx.processing = true;
        
        console.log('✅ Transaction found in pending list');
        console.log('🚀 Starting real transaction submission...');
        console.log('Transaction ID:', txId);
        console.log('Session Wallet Address:', currentSessionWallet?.address);
        console.log('Master Wallet Address:', masterWallet?.address);
        console.log('Current session wallet exists?', !!currentSessionWallet);
        console.log('Master wallet exists?', !!masterWallet);
        
        console.log('🔧 Starting transaction execution...');
        
        // Initialize progress tracking (we'll adjust total steps later based on funding needs)
        updateTransactionProgress(txId, 0, 2, 'Preparing transaction...', 'processing');
        
        // Remove from pending list immediately to close UI
        pendingTransactions.delete(txId);
        
        // Send immediate response to close the approval UI
        sendResponse({ success: true, message: 'Transaction approved and processing started' });
        
        // Continue processing in background
        (async () => {
        try {
          console.log('📡 Creating provider connection...');
          // Create provider for Sepolia
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          console.log('✅ Provider created successfully');
          
          if (!currentSessionWallet) {
            throw new Error('No session wallet available');
          }
          
          // STEP 1: Estimate gas on ORIGINAL transaction params (before address replacement)
          console.log('🔍 Estimating gas on original transaction params...');
          console.log('   To:', pendingTx.txParams.to);
          console.log('   Value:', pendingTx.txParams.value || '0x0');
          console.log('   Data:', pendingTx.txParams.data || '0x');
          console.log('   From (original):', pendingTx.txParams.from);
          
          const estimatedGas = await provider.estimateGas({
            to: pendingTx.txParams.to,
            value: pendingTx.txParams.value || '0x0',
            data: pendingTx.txParams.data || '0x',
            from: pendingTx.txParams.from // Use original from address for estimation
          });
          
          console.log('✅ Gas estimation successful with original params');
          
          // STEP 2: Now apply address spoofing replacements after gas estimation
          const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
          const addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
          
          if (addressSpoofingEnabled && currentSessionWallet) {
            const originalTxParams = JSON.stringify(pendingTx.txParams, null, 2);
            
            // Function to recursively replace spoofed address in any object/string
            const replaceSpoofedAddress = (obj: any): any => {
              if (typeof obj === 'string') {
                if (obj.toLowerCase() === SPOOFED_ADDRESS.toLowerCase()) {
                  console.log(`🔄 Found spoofed address in string: ${obj} -> ${currentSessionWallet!.address}`);
                  return currentSessionWallet!.address;
                }
                // Also check if it's hex data containing the address (remove 0x prefix for comparison)
                if (obj.startsWith('0x') && obj.toLowerCase().includes(SPOOFED_ADDRESS.toLowerCase().slice(2))) {
                  console.log(`🔄 Found spoofed address in hex data: ${obj}`);
                  const replaced = obj.replace(
                    new RegExp(SPOOFED_ADDRESS.slice(2), 'gi'), 
                    currentSessionWallet!.address.slice(2)
                  );
                  console.log(`   -> ${replaced}`);
                  return replaced;
                }
                return obj;
              } else if (Array.isArray(obj)) {
                return obj.map(replaceSpoofedAddress);
              } else if (obj && typeof obj === 'object') {
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                  result[key] = replaceSpoofedAddress(value);
                }
                return result;
              }
              return obj;
            };

            pendingTx.txParams = replaceSpoofedAddress(pendingTx.txParams);
            
            const modifiedTxParams = JSON.stringify(pendingTx.txParams, null, 2);
            if (originalTxParams !== modifiedTxParams) {
              console.log(`🎭 SPOOFED ADDRESS REPLACEMENT COMPLETED`);
              console.log(`   Original:`, originalTxParams);
              console.log(`   Modified:`, modifiedTxParams);
            }
          }
          
          // STEP 3: Connect wallets and check balances
          const connectedSessionWallet = currentSessionWallet.connect(provider);
          const connectedMasterWallet = masterWallet!.connect(provider);
          console.log('🔗 Wallets connected to provider');
          
          // Check master's balance in Pool contract first
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, provider);
          console.log('🔍 Checking Pool contract at:', POOL_CONTRACT_ADDRESS);
          console.log('🔍 Checking balance for master wallet:', masterWallet!.address);
          
          const masterPoolBalance = await poolContract.getFunction('getBalance')(masterWallet!.address);
          console.log('🏛️ Master pool balance:', ethers.formatEther(masterPoolBalance), 'ETH');
          console.log('🏛️ Master pool balance (wei):', masterPoolBalance.toString());
          console.log('🏛️ Master wallet address:', masterWallet!.address);
          
          if (masterPoolBalance === 0n) {
            console.log('⚠️ WARNING: Master wallet has ZERO balance in Pool contract!');
            console.log('   This means no funds have been deposited to the Pool contract yet.');
            console.log('   You need to deposit ETH to the Pool contract first using the deposit suggestion.');
          }
          
          // Check current session wallet balance
          const sessionBalance = await provider.getBalance(currentSessionWallet.address);
          console.log('💰 Current session wallet balance:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('💰 Current session wallet address:', currentSessionWallet.address);
          
          const gasPrice = await provider.getFeeData();
          const maxFeePerGas = gasPrice.maxFeePerGas || gasPrice.gasPrice || ethers.parseUnits('20', 'gwei');
          const gasCost = estimatedGas * maxFeePerGas;
          const txValue = BigInt(pendingTx.txParams.value || '0x0');
          const totalNeeded = gasCost + txValue;
          
          console.log('⛽ Gas estimate:', estimatedGas.toString());
          console.log('💸 Max fee per gas:', ethers.formatUnits(maxFeePerGas, 'gwei'), 'gwei');
          console.log('💸 Gas cost:', ethers.formatEther(gasCost), 'ETH');
          console.log('💵 Transaction value:', ethers.formatEther(txValue), 'ETH');
          console.log('🧮 Total needed:', ethers.formatEther(totalNeeded), 'ETH');
          console.log('💰 Current balance:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('❓ Need funding?', sessionBalance < totalNeeded);
          console.log('🔍 DETAILED FUNDING ANALYSIS:');
          console.log('   Session has:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('   Needs total:', ethers.formatEther(totalNeeded), 'ETH');
          console.log('   Pool has:', ethers.formatEther(masterPoolBalance), 'ETH');
          console.log('   Deficit:', ethers.formatEther(totalNeeded - sessionBalance), 'ETH');
          
          // Fund session wallet if needed using Pool contract
          if (sessionBalance < totalNeeded) {
            // Update progress: Step 1 - Withdrawing from Pool
            updateTransactionProgress(txId, 1, 2, 'Withdrawing from Pool contract...', 'processing');
            
            const fundingAmount = totalNeeded - sessionBalance + ethers.parseEther('0.01'); // Add buffer
            console.log('🏦 FUNDING SESSION WALLET REQUIRED!');
            console.log('   📊 Balance check:', ethers.formatEther(sessionBalance), '<', ethers.formatEther(totalNeeded));
            console.log('   💰 Funding amount:', ethers.formatEther(fundingAmount), 'ETH');
            console.log('   📤 From (Pool contract):', POOL_CONTRACT_ADDRESS);
            console.log('   📥 To (session):', currentSessionWallet.address);
            
            // Check if master has enough funds in Pool contract (reuse the already fetched balance)
            if (masterPoolBalance < fundingAmount) {
              throw new Error(`Pool contract insufficient funds: has ${ethers.formatEther(masterPoolBalance)} ETH, needs ${ethers.formatEther(fundingAmount)} ETH`);
            }
            
            console.log('📡 Sending Pool withdraw transaction...');
            try {
              console.log('🔗 Connecting Pool contract to master wallet...');
              const connectedPoolContract = poolContract.connect(connectedMasterWallet);
              console.log('✅ Pool contract connected');
              
              console.log('🎯 Calling Pool withdraw function with params:');
              console.log('   Destination:', currentSessionWallet.address);
              console.log('   Amount:', ethers.formatEther(fundingAmount), 'ETH');
              console.log('   Amount (wei):', fundingAmount.toString());
              
              const fundingTx = await connectedPoolContract.getFunction('withdraw')(currentSessionWallet.address, fundingAmount);
              console.log('✅ Pool withdraw transaction created successfully');
              
              console.log('⏳ Pool withdraw transaction sent:', fundingTx.hash);
              console.log('🔗 View funding tx:', `https://sepolia.etherscan.io/tx/${fundingTx.hash}`);
              
              console.log('⏳ Waiting for Pool withdraw confirmation...');
              const fundingReceipt = await fundingTx.wait();
              console.log('✅ Pool withdraw transaction confirmed!');
              console.log('📋 Pool withdraw receipt:', fundingReceipt);
              
              // Wait and retry balance checking since it may take time to propagate
              let newSessionBalance = 0n;
              let attempts = 0;
              const maxAttempts = 5;
              
              while (attempts < maxAttempts) {
                console.log(`⏳ Checking balance (attempt ${attempts + 1}/${maxAttempts})...`);
                newSessionBalance = await provider.getBalance(currentSessionWallet.address);
                console.log('💰 Session wallet balance:', ethers.formatEther(newSessionBalance), 'ETH');
                
                if (newSessionBalance >= totalNeeded) {
                  console.log('✅ Funding verification: SUCCESS');
                  break;
                }
                
                if (attempts < maxAttempts - 1) {
                  console.log('⏳ Balance still insufficient, waiting 3 seconds before retry...');
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
                attempts++;
              }
              
              // Final check after all attempts
              if (newSessionBalance < totalNeeded) {
                const stillNeeded = totalNeeded - newSessionBalance;
                console.log('❌ Funding verification: FAILED after', maxAttempts, 'attempts');
                throw new Error(`Funding incomplete! Session wallet still needs ${ethers.formatEther(stillNeeded)} ETH more. Pool withdraw transaction was confirmed but balance not updated after ${maxAttempts} attempts.`);
              }
              
              // Update progress: Pool withdraw completed successfully
              updateTransactionProgress(txId, 1, 2, 'Pool withdraw completed successfully', 'processing');
              
            } catch (fundingError: any) {
              console.error('💥 POOL WITHDRAW FUNDING FAILED:', fundingError);
              console.error('Error details:', {
                message: fundingError?.message || 'Unknown error',
                code: fundingError?.code || 'No code',
                reason: fundingError?.reason || 'No reason'
              });
              
              // Fallback to direct wallet transfer if Pool contract fails
              console.log('🔄 ATTEMPTING FALLBACK: Direct wallet transfer...');
              try {
                // Check if master has enough direct funds for fallback
                const masterDirectBalance = await provider.getBalance(masterWallet!.address);
                console.log('🏛️ Master direct balance:', ethers.formatEther(masterDirectBalance), 'ETH');
                
                if (masterDirectBalance < fundingAmount) {
                  throw new Error(`Both Pool and direct wallet insufficient funds. Pool error: ${fundingError?.message || 'Unknown'}. Direct wallet has ${ethers.formatEther(masterDirectBalance)} ETH, needs ${ethers.formatEther(fundingAmount)} ETH`);
                }
                
                console.log('📡 Sending direct wallet transfer as fallback...');
                const fallbackTx = await connectedMasterWallet.sendTransaction({
                  to: currentSessionWallet.address,
                  value: fundingAmount,
                  gasLimit: 21000 // Simple transfer
                });
                
                console.log('⏳ Fallback transfer sent:', fallbackTx.hash);
                await fallbackTx.wait();
                console.log('✅ Fallback transfer confirmed!');
                
                // Verify fallback worked
                const finalBalance = await provider.getBalance(currentSessionWallet.address);
                console.log('💰 Final session balance after fallback:', ethers.formatEther(finalBalance), 'ETH');
                
                if (finalBalance < totalNeeded) {
                  const stillNeeded = totalNeeded - finalBalance;
                  throw new Error(`Even fallback transfer failed! Still need ${ethers.formatEther(stillNeeded)} ETH more.`);
                }
                
              } catch (fallbackError: any) {
                console.error('💥 FALLBACK ALSO FAILED:', fallbackError);
                throw new Error(`Both Pool withdraw and fallback failed. Pool: ${fundingError?.message || 'Unknown'}. Fallback: ${fallbackError?.message || 'Unknown'}`);
              }
            }
          } else {
            console.log('✅ Session wallet has sufficient balance - no funding needed');
            // Update progress: Step 1 completed (no funding needed)
            updateTransactionProgress(txId, 1, 2, 'Funding check completed', 'processing');
          }
          
          // Update progress: Step 2 - Executing transaction
          updateTransactionProgress(txId, 2, 2, 'Executing transaction...', 'processing');
          
          // Prepare transaction - use the exact params from dApp  
          const txRequest = {
            to: pendingTx.txParams.to,
            value: pendingTx.txParams.value || '0x0',
            data: pendingTx.txParams.data || '0x',
            // Use our estimated gas and fee data
            gasLimit: estimatedGas,
            maxFeePerGas: maxFeePerGas,
            // Let provider determine nonce
            nonce: await provider.getTransactionCount(connectedSessionWallet.address)
          };
          
          console.log('📝 Transaction request prepared:', txRequest);
          
          // Send transaction
          console.log('📤 Sending transaction to network...');
          const txResponse = await connectedSessionWallet.sendTransaction(txRequest);
          console.log('✅ Transaction submitted! Hash:', txResponse.hash);
          console.log('🔍 View on Etherscan:', `https://sepolia.etherscan.io/tx/${txResponse.hash}`);
          
          // Update progress: Transaction submitted successfully
          updateTransactionProgress(txId, 2, 2, 'Transaction submitted successfully', 'completed', txResponse.hash);
          
          // Resolve the pending promise with real hash
          pendingTx.resolve(txResponse.hash);
          
          console.log('⏳ Waiting for confirmation...');
          // Wait for confirmation in background (don't block UI)
          txResponse.wait().then((receipt) => {
            if (receipt) {
              console.log('🎉 Transaction confirmed!', receipt);
              console.log('Gas used:', receipt.gasUsed.toString());
              console.log('Block number:', receipt.blockNumber);
              // Clear progress after confirmation
              setTimeout(() => clearTransactionProgress(), 5000); // Clear after 5 seconds
            }
          }).catch((error: any) => {
            console.error('❌ Transaction failed:', error);
            updateTransactionProgress(txId, 2, 2, 'Transaction failed', 'error', undefined, error.message);
            setTimeout(() => clearTransactionProgress(), 10000); // Clear after 10 seconds on error
          });
          
        } catch (error: any) {
          console.error('💥💥💥 TRANSACTION SUBMISSION COMPLETELY FAILED 💥💥💥');
          console.error('❌ Error object:', error);
          console.error('❌ Error message:', error?.message || 'Unknown error');
          console.error('❌ Error code:', error?.code || 'No code');
          console.error('❌ Error reason:', error?.reason || 'No reason');
          console.error('❌ Error stack:', error?.stack || 'No stack');
          console.error('❌ Error data:', error?.data || 'No data');
          
          // Check if it's an insufficient funds error specifically
          if (error?.message?.includes('insufficient funds') || error?.reason?.includes('insufficient funds')) {
            console.error('🚨 INSUFFICIENT FUNDS ERROR DETECTED');
            console.error('   This means the funding mechanism failed or was skipped');
            console.error('   Check if the funding logs appeared above');
          }
          
          // Update progress: Error occurred
          updateTransactionProgress(txId, 0, 2, 'Transaction failed', 'error', undefined, error?.message || 'Unknown error');
          setTimeout(() => clearTransactionProgress(), 10000); // Clear after 10 seconds on error
          
          pendingTx.reject(error);
        }
        })(); // Close the async IIFE
      }
      
      if (msg.type === 'rejectTransaction') {
        const { txId } = msg;
        const pendingTx = pendingTransactions.get(txId);
        if (pendingTx) {
          console.log('❌ Transaction rejected');
          pendingTx.reject(new Error('User rejected transaction'));
          pendingTransactions.delete(txId);
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Transaction not found' });
        }
      }
      
      if (msg.type === 'getAllSessions') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          const sessions = [];
          // Generate all session addresses up to current session counter
          for (let i = 1; i <= sessionCounter; i++) {
            const derivationPath = `m/44'/60'/0'/0/${i}`;
            const sessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
            sessions.push({
              sessionNumber: i,
              address: sessionWallet.address,
              isCurrent: i === sessionCounter
            });
          }
          
          // Sort by session number descending (newest first)
          sessions.sort((a, b) => b.sessionNumber - a.sessionNumber);
          sendResponse(sessions);
        } catch (error) {
          console.error('Error generating session list:', error);
          sendResponse({ error: 'Failed to generate session list' });
        }
      }
      
      if (msg.type === 'switchToSession') {
        const { sessionNumber } = msg;
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          // Generate the specified session wallet
          const derivationPath = `m/44'/60'/0'/0/${sessionNumber}`;
          const sessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
          
          // Update current session
          currentSessionWallet = sessionWallet;
          sessionCounter = sessionNumber;
          
          // Save to storage
          await chrome.storage.local.set({ sessionCounter });
          
          console.log(`🔄 Switched to session #${sessionNumber}:`, sessionWallet.address);
          sendResponse({ success: true, address: sessionWallet.address });
        } catch (error) {
          console.error('Error switching session:', error);
          sendResponse({ error: 'Failed to switch session' });
        }
      }
      
      if (msg.type === 'getMasterBalance') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          // Create provider to check balance
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const balance = await provider.getBalance(masterWallet.address);
          const balanceInEth = ethers.formatEther(balance);
          
          // Format to 4 decimal places
          const formattedBalance = parseFloat(balanceInEth).toFixed(4);
          
          sendResponse({ balance: formattedBalance });
        } catch (error) {
          console.error('Error getting master balance:', error);
          sendResponse({ error: 'Failed to get balance' });
        }
      }
      
      if (msg.type === 'getPrivateKey') {
        if (!currentSessionWallet) {
          sendResponse({ error: 'No session wallet available' });
          return;
        }
        
        try {
          // Return the private key without the 0x prefix for viem compatibility
          const privateKey = currentSessionWallet.privateKey.slice(2);
          sendResponse({ privateKey });
        } catch (error) {
          console.error('Error getting private key:', error);
          sendResponse({ error: 'Failed to get private key' });
        }
      }
      
      if (msg.type === 'fundSessionIfNeeded') {
        const { sessionAddress, requiredAmount } = msg;
        
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          console.log(`🔋 Checking if session ${sessionAddress} needs funding...`);
          
          // Create provider to check balances
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          
          // Check session wallet balance
          const sessionBalance = await provider.getBalance(sessionAddress);
          const requiredWei = ethers.parseEther(requiredAmount);
          
          console.log(`💰 Session balance: ${ethers.formatEther(sessionBalance)} ETH`);
          console.log(`🎯 Required: ${requiredAmount} ETH`);
          
          if (sessionBalance >= requiredWei) {
            console.log('✅ Session has sufficient balance, no funding needed');
            sendResponse({ success: true, funded: false, message: 'Session already has sufficient balance' });
            return;
          }
          
          // Check master wallet balance
          const masterBalance = await provider.getBalance(masterWallet.address);
          console.log(`🏛️ Master balance: ${ethers.formatEther(masterBalance)} ETH`);
          
          if (masterBalance < requiredWei) {
            sendResponse({ error: `Master wallet insufficient funds: has ${ethers.formatEther(masterBalance)} ETH, needs ${requiredAmount} ETH` });
            return;
          }
          
          // Fund the session wallet using Pool contract withdraw method
          console.log(`💸 Funding session with ${requiredAmount} ETH using Pool contract...`);
          const connectedMasterWallet = masterWallet.connect(provider);
          
          // Create pool contract instance
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, connectedMasterWallet);
          
          // Use withdraw method instead of direct transfer
          const fundingTx = await poolContract.getFunction('withdraw')(sessionAddress, requiredWei);
          
          console.log(`📝 Pool withdraw transaction sent: ${fundingTx.hash}`);
          console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${fundingTx.hash}`);
          
          // Wait for confirmation
          await fundingTx.wait();
          console.log('✅ Pool withdraw transaction confirmed!');
          
          // Verify new balance
          const newSessionBalance = await provider.getBalance(sessionAddress);
          console.log(`💰 New session balance: ${ethers.formatEther(newSessionBalance)} ETH`);
          
          sendResponse({ 
            success: true, 
            funded: true, 
            txHash: fundingTx.hash,
            newBalance: ethers.formatEther(newSessionBalance),
            message: `Session funded with ${requiredAmount} ETH via Pool contract`
          });
          
        } catch (error) {
          console.error('❌ Pool withdraw funding failed:', error);
          sendResponse({ error: `Pool withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
      }
      
      if (msg.type === 'getPoolBalance') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, provider);
          
          const balance = await poolContract.getFunction('getBalance')(masterWallet.address);
          const balanceInEth = ethers.formatEther(balance);
          
          sendResponse({ balance: balanceInEth });
        } catch (error) {
          console.error('Error getting pool balance:', error);
          sendResponse({ error: 'Failed to get pool balance' });
        }
      }
      
      if (msg.type === 'getTransactionProgress') {
        sendResponse({ progress: activeTransactionProgress });
      }
      
      if (msg.type === 'depositToPool') {
        const { amount } = msg;
        
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          console.log(`💰 Depositing ${amount} ETH to Pool contract...`);
          
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const connectedMasterWallet = masterWallet.connect(provider);
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, connectedMasterWallet);
          
          const depositAmount = ethers.parseEther(amount);
          
          const depositTx = await poolContract.getFunction('deposit')({ value: depositAmount });
          
          console.log(`📝 Pool deposit transaction sent: ${depositTx.hash}`);
          console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${depositTx.hash}`);
          
          // Wait for confirmation
          await depositTx.wait();
          console.log('✅ Pool deposit transaction confirmed!');
          
          // Get updated pool balance
          const newPoolBalance = await poolContract.getFunction('getBalance')(masterWallet.address);
          console.log(`💰 New pool balance: ${ethers.formatEther(newPoolBalance)} ETH`);
          
          sendResponse({ 
            success: true, 
            txHash: depositTx.hash,
            newPoolBalance: ethers.formatEther(newPoolBalance),
            message: `Deposited ${amount} ETH to Pool contract`
          });
          
        } catch (error) {
          console.error('❌ Pool deposit failed:', error);
          sendResponse({ error: `Pool deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});