import { ethers } from 'ethers';

let masterWallet: ethers.HDNodeWallet | null = null;
let currentSessionWallet: ethers.HDNodeWallet | null = null;
let sessionCounter = 0;
let currentChainId = '0xaa36a7'; // Sepolia testnet
let currentNetworkVersion = '11155111';

// Transaction management
let pendingTransactions: Map<string, {
  txParams: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}> = new Map();

const initializeMasterWallet = async () => {
  try {
    const result = await chrome.storage.local.get(['seedPhrase']);
    if (result.seedPhrase) {
      masterWallet = ethers.HDNodeWallet.fromPhrase(result.seedPhrase);
      console.log('Master wallet initialized from seed phrase');
      
      // Load session counter
      const sessionResult = await chrome.storage.local.get(['sessionCounter']);
      sessionCounter = sessionResult.sessionCounter || 0;
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

initializeMasterWallet();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('🎯 Background received message:', msg.type, msg);
  
  (async () => {
    try {
      if (msg.type === 'connect') {
        if (!masterWallet) {
          sendResponse(null);
          return;
        }
        
        // Generate fresh session wallet for each connection
        const sessionWallet = await generateFreshSessionWallet();
        if (sessionWallet) {
          sendResponse(sessionWallet.address);
        } else {
          sendResponse(null);
        }
      }
      
      if (msg.type === 'getAccounts') {
        if (currentSessionWallet) {
          sendResponse(currentSessionWallet.address);
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
        
        const { txParams } = msg;
        const txId = Date.now().toString();
        
        console.log('🔥 TRANSACTION CONFIRMATION REQUIRED 🔥');
        console.log('Transaction ID:', txId);
        console.log('Raw Transaction Params:', txParams);
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
        const pendingTx = pendingTransactions.get(txId);
        if (!pendingTx) {
          sendResponse({ error: 'Transaction not found' });
          return;
        }

        console.log('🚀 Starting real transaction submission...');
        console.log('Transaction ID:', txId);
        console.log('Session Wallet Address:', currentSessionWallet?.address);
        
        try {
          // Create provider for Sepolia
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          console.log('📡 Connected to provider:', provider);
          
          if (!currentSessionWallet) {
            throw new Error('No session wallet available');
          }
          
          // Connect wallet to provider
          const connectedWallet = currentSessionWallet.connect(provider);
          console.log('🔗 Wallet connected to provider');
          
          // Prepare transaction - use the exact params from dApp
          const txRequest = {
            to: pendingTx.txParams.to,
            value: pendingTx.txParams.value || '0x0',
            data: pendingTx.txParams.data || '0x',
            // Let ethers.js estimate gas if not provided
            ...(pendingTx.txParams.gasLimit && { gasLimit: pendingTx.txParams.gasLimit }),
            ...(pendingTx.txParams.gasPrice && { gasPrice: pendingTx.txParams.gasPrice }),
            ...(pendingTx.txParams.maxFeePerGas && { maxFeePerGas: pendingTx.txParams.maxFeePerGas }),
            ...(pendingTx.txParams.maxPriorityFeePerGas && { maxPriorityFeePerGas: pendingTx.txParams.maxPriorityFeePerGas }),
            // Let provider determine nonce
            nonce: await provider.getTransactionCount(connectedWallet.address)
          };
          
          console.log('📝 Transaction request prepared:', txRequest);
          
          // If no gas limit provided, let ethers estimate
          if (!pendingTx.txParams.gasLimit) {
            try {
              const estimatedGas = await provider.estimateGas(txRequest);
              console.log('⛽ Estimated gas:', estimatedGas.toString());
              txRequest.gasLimit = estimatedGas;
            } catch (gasError: any) {
              console.warn('⚠️ Gas estimation failed, using default:', gasError.message);
            }
          }
          
          // Send transaction
          console.log('📤 Sending transaction to network...');
          const txResponse = await connectedWallet.sendTransaction(txRequest);
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
          console.error('💥 Transaction submission failed:', error);
          console.error('Error details:', {
            message: error?.message || 'Unknown error',
            code: error?.code || 'No code',
            stack: error?.stack || 'No stack'
          });
          
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
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});