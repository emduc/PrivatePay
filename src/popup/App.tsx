import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';


interface WalletInfo {
  masterAddress: string;
  currentSessionAddress: string | null;
  sessionCount: number;
}

interface PendingTransaction {
  id: string;
  txParams: any;
  timestamp: number;
  from: string;
}

interface SessionAddress {
  sessionNumber: number;
  address: string;
  isCurrent: boolean;
}

const App = () => {
  const [mnemonic, setMnemonic] = useState('');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [addressSpoofing, setAddressSpoofing] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionAddresses, setSessionAddresses] = useState<SessionAddress[]>([]);

  useEffect(() => {
    loadExistingWallet();
    loadAddressSpoofing();
  }, []);

  const loadAddressSpoofing = async () => {
    try {
      const result = await chrome.storage.local.get(['addressSpoofing']);
      setAddressSpoofing(result.addressSpoofing || false);
    } catch (err) {
      console.error('Error loading address spoofing setting:', err);
    }
  };

  const toggleAddressSpoofing = async () => {
    const newValue = !addressSpoofing;
    setAddressSpoofing(newValue);
    try {
      await chrome.storage.local.set({ addressSpoofing: newValue });
      console.log('Address spoofing set to:', newValue);
    } catch (err) {
      console.error('Error saving address spoofing setting:', err);
    }
  };

  const loadSessionAddresses = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getAllSessions' });
      if (response && !response.error) {
        setSessionAddresses(response);
      }
    } catch (err) {
      console.error('Error loading session addresses:', err);
    }
  };

  const switchToSession = async (sessionNumber: number) => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'switchToSession', 
        sessionNumber 
      });
      if (response && !response.error) {
        await loadExistingWallet();
        await loadSessionAddresses();
        setShowSessionList(false);
      }
    } catch (err) {
      console.error('Error switching session:', err);
    }
  };

  const loadExistingWallet = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getWalletInfo' });
      if (response && !response.error) {
        setWalletInfo(response);
      }
      await loadPendingTransactions();
    } catch (err) {
      console.error('Error loading wallet:', err);
    }
  };

  const loadPendingTransactions = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getPendingTransactions' });
      if (response && Array.isArray(response)) {
        setPendingTransactions(response);
      }
    } catch (err) {
      console.error('Error loading pending transactions:', err);
    }
  };

  const approveTransaction = async (txId: string) => {
    try {
      console.log('🚀 Popup: Approving transaction:', txId);
      const response = await chrome.runtime.sendMessage({ type: 'approveTransaction', txId });
      console.log('📨 Popup: Response from background:', response);
      await loadPendingTransactions(); // Refresh the list
    } catch (err) {
      console.error('Error approving transaction:', err);
    }
  };

  const rejectTransaction = async (txId: string) => {
    try {
      await chrome.runtime.sendMessage({ type: 'rejectTransaction', txId });
      await loadPendingTransactions(); // Refresh the list
    } catch (err) {
      console.error('Error rejecting transaction:', err);
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
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'white'
    }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>
        Welcome to PrivatePay
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
            
            {/* <div style={{ marginBottom: '15px' }}>
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
            </div> */}
            
            {walletInfo.currentSessionAddress && (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ color: '#28a745' }}>Current Session Address:</strong>
                  <button
                    onClick={() => {
                      setShowSessionList(!showSessionList);
                      if (!showSessionList) {
                        loadSessionAddresses();
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    {showSessionList ? 'Hide Sessions' : 'Show All Sessions'}
                  </button>
                </div>
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
                
                {showSessionList && (
                  <div style={{
                    marginTop: '10px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <div style={{ 
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: '#e9ecef'
                    }}>
                      Previous Sessions (click to switch)
                    </div>
                    {sessionAddresses.length > 0 ? (
                      sessionAddresses.map((session) => (
                        <div
                          key={session.sessionNumber}
                          onClick={() => switchToSession(session.sessionNumber)}
                          style={{
                            padding: '8px',
                            borderBottom: '1px solid #dee2e6',
                            cursor: 'pointer',
                            backgroundColor: session.isCurrent ? '#d4edda' : 'transparent',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!session.isCurrent) {
                              e.currentTarget.style.backgroundColor = '#e9ecef';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!session.isCurrent) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px' }}>
                            Session #{session.sessionNumber} {session.isCurrent && '(Current)'}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            color: '#495057'
                          }}>
                            {session.address}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', fontSize: '11px', color: '#6c757d', textAlign: 'center' }}>
                        No previous sessions found
                      </div>
                    )}
                  </div>
                )}
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
            <p style={{ fontSize: '13px', color: '#856404', margin: '0 0 10px 0' }}>
              <strong>🔄 Fresh Address Mode:</strong> Each time you connect to a dApp, 
              a new address will be generated for enhanced privacy.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="addressSpoofing"
                checked={addressSpoofing}
                onChange={toggleAddressSpoofing}
                style={{ cursor: 'pointer' }}
              />
              <label 
                htmlFor="addressSpoofing" 
                style={{ fontSize: '12px', color: '#856404', cursor: 'pointer' }}
              >
                <strong>🎭 Address Spoofing:</strong> Show fake rich address (0xA6a49...83B5) to dApps
              </label>
            </div>
          </div>

          {pendingTransactions.length > 0 && (
            <div style={{ 
              marginBottom: '15px',
              padding: '15px',
              backgroundColor: '#fff3cd',
              border: '2px solid #ff6b35',
              borderRadius: '4px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#d63384' }}>
                🔥 Pending Transactions ({pendingTransactions.length})
              </h4>
              
              {pendingTransactions.map((tx) => (
                <div key={tx.id} style={{ 
                  marginBottom: '15px',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>To:</strong> 
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {tx.txParams.to}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Value:</strong> {tx.txParams.value ? ethers.formatEther(tx.txParams.value) + ' ETH' : '0 ETH'}
                  </div>
                  
                  <div style={{ marginBottom: '12px', fontSize: '11px', color: '#6c757d' }}>
                    Gas Limit: {tx.txParams.gasLimit || 'Not set'}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => approveTransaction(tx.id)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => rejectTransaction(tx.id)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
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
      
      {walletInfo && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span
            onClick={clearWallet}
            style={{
              fontSize: '10px',
              color: '#6c757d',
              cursor: 'pointer',
              textDecoration: 'underline',
              opacity: 0.7
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = '#dc3545';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.color = '#6c757d';
            }}
          >
            Change secret
          </span>
        </div>
      )}
    </div>
  );
};

export default App;