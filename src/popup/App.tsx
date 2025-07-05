import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const App = () => {
  const [mnemonic, setMnemonic] = useState('');
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExistingWallet();
  }, []);

  const loadExistingWallet = async () => {
    try {
      const result = await chrome.storage.local.get(['privateKey']);
      if (result.privateKey) {
        const w = new ethers.Wallet(result.privateKey);
        setWallet(w);
      }
    } catch (err) {
      console.error('Error loading wallet:', err);
    }
  };

  const importWallet = async () => {
    if (!mnemonic.trim()) {
      setError('Please enter a seed phrase');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const w = ethers.Wallet.fromPhrase(mnemonic.trim());
      
      const response = await chrome.runtime.sendMessage({
        type: 'importWallet',
        privateKey: w.privateKey
      });

      if (response.error) {
        setError(response.error);
      } else {
        setWallet(w);
        setMnemonic('');
        setError('');
      }
    } catch (err) {
      setError('Invalid seed phrase');
    } finally {
      setIsImporting(false);
    }
  };

  const clearWallet = async () => {
    try {
      await chrome.storage.local.remove(['privateKey']);
      setWallet(null);
      setMnemonic('');
      setError('');
    } catch (err) {
      console.error('Error clearing wallet:', err);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      width: '350px', 
      minHeight: '400px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>
        Mini ETH Wallet
      </h2>
      
      {!wallet ? (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#666' }}>
              Enter 12-word seed phrase:
            </label>
            <textarea
              rows={3}
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="word1 word2 word3 ..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>
          
          {error && (
            <div style={{ 
              color: 'red', 
              fontSize: '12px', 
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#ffebee',
              border: '1px solid #ffcdd2',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
          
          <button
            onClick={importWallet}
            disabled={isImporting || !mnemonic.trim()}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isImporting ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {isImporting ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '4px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
              Wallet Connected
            </h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>Address:</strong>
              <div style={{ 
                marginTop: '5px',
                wordBreak: 'break-all',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#666'
              }}>
                {wallet.address}
              </div>
            </div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>
              Your wallet is ready to use with dApps. Visit any Ethereum dApp and connect your wallet.
            </p>
          </div>
          
          <button
            onClick={clearWallet}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Clear Wallet
          </button>
        </div>
      )}
      
      <div style={{ 
        marginTop: '20px', 
        padding: '10px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #bee5eb',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#0c5460'
      }}>
        <strong>Security Notice:</strong> This is a Proof of Concept. 
        Do not use with real funds.
      </div>
    </div>
  );
};

export default App;