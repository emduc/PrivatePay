import { ethers } from 'ethers';

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
}> = new Map();

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
          sendResponse(result);
        }).catch((error) => {
          sendResponse({ error: error.message });
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
        
        console.log('✅ Transaction found in pending list');
        console.log('🚀 Starting real transaction submission...');
        console.log('Transaction ID:', txId);
        console.log('Session Wallet Address:', currentSessionWallet?.address);
        console.log('Master Wallet Address:', masterWallet?.address);
        console.log('Current session wallet exists?', !!currentSessionWallet);
        console.log('Master wallet exists?', !!masterWallet);
        
        console.log('🔧 Starting transaction execution...');
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
          
          // Check master wallet balance first
          const masterBalance = await provider.getBalance(masterWallet!.address);
          console.log('🏛️ Master wallet balance:', ethers.formatEther(masterBalance), 'ETH');
          console.log('🏛️ Master wallet address:', masterWallet!.address);
          
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
          
          // Fund session wallet if needed
          if (sessionBalance < totalNeeded) {
            const fundingAmount = totalNeeded - sessionBalance + ethers.parseEther('0.01'); // Add buffer
            console.log('🏦 FUNDING SESSION WALLET REQUIRED!');
            console.log('   📊 Balance check:', ethers.formatEther(sessionBalance), '<', ethers.formatEther(totalNeeded));
            console.log('   💰 Funding amount:', ethers.formatEther(fundingAmount), 'ETH');
            console.log('   📤 From (master):', masterWallet!.address);
            console.log('   📥 To (session):', currentSessionWallet.address);
            
            // Check if master has enough funds
            if (masterBalance < fundingAmount) {
              throw new Error(`Master wallet insufficient funds: has ${ethers.formatEther(masterBalance)} ETH, needs ${ethers.formatEther(fundingAmount)} ETH`);
            }
            
            console.log('📡 Sending funding transaction...');
            try {
              const fundingTx = await connectedMasterWallet.sendTransaction({
                to: currentSessionWallet.address,
                value: fundingAmount,
                gasLimit: 21000 // Simple transfer
              });
              
              console.log('⏳ Funding transaction sent:', fundingTx.hash);
              console.log('🔗 View funding tx:', `https://sepolia.etherscan.io/tx/${fundingTx.hash}`);
              
              console.log('⏳ Waiting for funding confirmation...');
              const fundingReceipt = await fundingTx.wait();
              console.log('✅ Funding transaction confirmed!');
              console.log('📋 Funding receipt:', fundingReceipt);
              
              // Verify new balance
              const newSessionBalance = await provider.getBalance(currentSessionWallet.address);
              console.log('💰 New session wallet balance:', ethers.formatEther(newSessionBalance), 'ETH');
              console.log('✅ Funding verification:', newSessionBalance >= totalNeeded ? 'SUCCESS' : 'FAILED');
              
            } catch (fundingError: any) {
              console.error('💥 FUNDING TRANSACTION FAILED:', fundingError);
              console.error('Error details:', {
                message: fundingError?.message || 'Unknown error',
                code: fundingError?.code || 'No code',
                reason: fundingError?.reason || 'No reason'
              });
              throw new Error(`Funding failed: ${fundingError?.message || 'Unknown error'}`);
            }
          } else {
            console.log('✅ Session wallet has sufficient balance - no funding needed');
          }
          
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
          
          // Resolve the pending promise with real hash
          pendingTx.resolve(txResponse.hash);
          pendingTransactions.delete(txId);
          
          console.log('⏳ Waiting for confirmation...');
          // Optionally wait for confirmation (don't block UI)
          txResponse.wait().then((receipt) => {
            if (receipt) {
              console.log('🎉 Transaction confirmed!', receipt);
              console.log('Gas used:', receipt.gasUsed.toString());
              console.log('Block number:', receipt.blockNumber);
            }
          }).catch((error: any) => {
            console.error('❌ Transaction failed:', error);
          });
          
          sendResponse({ success: true, hash: txResponse.hash });
          
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
          
          pendingTx.reject(error);
          pendingTransactions.delete(txId);
          sendResponse({ error: error?.message || 'Transaction failed' });
        }
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
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});