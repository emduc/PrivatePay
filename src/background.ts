import { ethers } from 'ethers';

let wallet: ethers.Wallet | null = null;

const initializeWallet = async () => {
  try {
    const result = await chrome.storage.local.get(['privateKey']);
    if (result.privateKey) {
      wallet = new ethers.Wallet(result.privateKey);
      console.log('Wallet initialized:', wallet.address);
    }
  } catch (error) {
    console.error('Error initializing wallet:', error);
  }
};

initializeWallet();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'connect') {
        if (!wallet) {
          sendResponse(null);
          return;
        }
        sendResponse(wallet.address);
      }
      
      if (msg.type === 'getAccounts') {
        if (!wallet) {
          sendResponse(null);
          return;
        }
        sendResponse(wallet.address);
      }
      
      if (msg.type === 'personalSign') {
        if (!wallet) {
          sendResponse({ error: 'No wallet connected' });
          return;
        }
        
        const { message } = msg;
        try {
          const signature = await wallet.signMessage(message);
          sendResponse(signature);
        } catch (error) {
          sendResponse({ error: 'Failed to sign message' });
        }
      }
      
      if (msg.type === 'sendTransaction') {
        if (!wallet) {
          sendResponse({ error: 'No wallet connected' });
          return;
        }
        
        const { txParams } = msg;
        try {
          const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_INFURA_KEY');
          const connectedWallet = wallet.connect(provider);
          const tx = await connectedWallet.sendTransaction(txParams);
          sendResponse(tx.hash);
        } catch (error) {
          sendResponse({ error: 'Failed to send transaction' });
        }
      }
      
      if (msg.type === 'importWallet') {
        const { privateKey } = msg;
        try {
          wallet = new ethers.Wallet(privateKey);
          await chrome.storage.local.set({ privateKey });
          sendResponse({ success: true, address: wallet.address });
        } catch (error) {
          sendResponse({ error: 'Invalid private key' });
        }
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});