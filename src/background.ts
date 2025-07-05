import { ethers } from 'ethers';

let masterWallet: ethers.Wallet | null = null;
let currentSessionWallet: ethers.Wallet | null = null;
let sessionCounter = 0;

const initializeMasterWallet = async () => {
  try {
    const result = await chrome.storage.local.get(['seedPhrase']);
    if (result.seedPhrase) {
      masterWallet = ethers.Wallet.fromPhrase(result.seedPhrase);
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
  const hdNode = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic.phrase, undefined, derivationPath);
  currentSessionWallet = new ethers.Wallet(hdNode.privateKey);
  
  console.log(`Generated fresh session wallet #${sessionCounter}:`, currentSessionWallet.address);
  return currentSessionWallet;
};

initializeMasterWallet();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
        try {
          const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_INFURA_KEY');
          const connectedWallet = currentSessionWallet.connect(provider);
          const tx = await connectedWallet.sendTransaction(txParams);
          sendResponse(tx.hash);
        } catch (error) {
          sendResponse({ error: 'Failed to send transaction' });
        }
      }
      
      if (msg.type === 'importWallet') {
        const { seedPhrase } = msg;
        try {
          // Validate seed phrase by creating wallet
          const testWallet = ethers.Wallet.fromPhrase(seedPhrase);
          
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
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});