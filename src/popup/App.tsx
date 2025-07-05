import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface WalletInfo {
  masterAddress: string;
  currentSessionAddress: string | null;
  sessionCount: number;
}

const App = () => {
  const [mnemonic, setMnemonic] = useState('');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExistingWallet();
  }, []);

  const loadExistingWallet = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getWalletInfo' });
      if (response && !response.error) {
        setWalletInfo(response);
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
      const response = await chrome.runtime.sendMessage({
        type: 'importWallet',
        seedPhrase: mnemonic.trim()
      });

      if (response.error) {
        setError(response.error);
      } else {
        setWalletInfo({
          masterAddress: response.masterAddress,
          currentSessionAddress: null,
          sessionCount: 0
        });
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
      await chrome.storage.local.remove(['seedPhrase', 'sessionCounter']);
      setWalletInfo(null);
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
      
      {!walletInfo ? (
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
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
              PrivatePay Wallet
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <strong style={{ color: '#495057' }}>Master Address:</strong>
              <div style={{ 
                marginTop: '5px',
                wordBreak: 'break-all',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#6c757d',
                backgroundColor: '#e9ecef',
                padding: '6px',
                borderRadius: '3px'
              }}>
                {walletInfo.masterAddress}
              </div>
            </div>
            
            {walletInfo.currentSessionAddress && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#28a745' }}>Current Session Address:</strong>
                <div style={{ 
                  marginTop: '5px',
                  wordBreak: 'break-all',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#155724',
                  backgroundColor: '#d4edda',
                  padding: '6px',
                  borderRadius: '3px'
                }}>
                  {walletInfo.currentSessionAddress}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              Sessions Generated: <strong>{walletInfo.sessionCount}</strong>
            </div>
          </div>
          
          <div style={{ 
            marginBottom: '15px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px'
          }}>
            <p style={{ fontSize: '13px', color: '#856404', margin: '0' }}>
              <strong>🔄 Fresh Address Mode:</strong> Each time you connect to a dApp, 
              a new address will be generated for enhanced privacy.
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