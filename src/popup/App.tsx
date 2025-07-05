import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useCCIPTransfer } from '../hooks/useCCIPTransfer';
import { CCIPSupportedChainId, CCIP_CHAIN_ID_TO_NAME } from '../lib/ccipChains';


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
  const [addressSpoofing, setAddressSpoofing] = useState(true);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionAddresses, setSessionAddresses] = useState<SessionAddress[]>([]);
  const [masterBalance, setMasterBalance] = useState<string>('0');
  const [poolBalance, setPoolBalance] = useState<string>('0');
  const [showDepositSuggestion, setShowDepositSuggestion] = useState(false);
  const [showPayUSDC, setShowPayUSDC] = useState(false);
  const [showPaymentOverview, setShowPaymentOverview] = useState(false);
  const [transactionProgress, setTransactionProgress] = useState<{
    txId: string;
    currentStep: number;
    totalSteps: number;
    stepName: string;
    status: 'processing' | 'completed' | 'error';
    txHash?: string;
    error?: string;
  } | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    destinationAddress: string;
    amount: string;
    destinationChain: CCIPSupportedChainId;
    tokenType: "USDC" | "CCIP-BnM";
  }>({
    destinationAddress: '',
    amount: '',
    destinationChain: CCIPSupportedChainId.ETH_SEPOLIA,
    tokenType: "USDC"
  });
  
  const { currentStep, logs, error: transferError, messageId, executeCCIPTransfer, reset } = useCCIPTransfer();

  useEffect(() => {
    loadExistingWallet();
    loadAddressSpoofing();
    loadMasterBalance();
    loadPoolBalance();
    
    // Poll for transaction progress updates
    const progressInterval = setInterval(loadTransactionProgress, 1000);
    return () => clearInterval(progressInterval);
  }, []);

  const loadMasterBalance = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getMasterBalance' });
      if (response && !response.error) {
        setMasterBalance(response.balance);
      }
    } catch (err) {
      console.error('Error loading master balance:', err);
    }
  };

  const loadPoolBalance = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getPoolBalance' });
      if (response && !response.error) {
        setPoolBalance(response.balance);
      }
    } catch (err) {
      console.error('Error loading pool balance:', err);
    }
  };

  const loadTransactionProgress = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getTransactionProgress' });
      if (response && response.progress) {
        setTransactionProgress(response.progress);
      } else {
        setTransactionProgress(null);
      }
    } catch (err) {
      console.error('Error loading transaction progress:', err);
    }
  };

  const depositToPool = async (amount: string) => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'depositToPool', amount });
      if (response && !response.error) {
        await loadMasterBalance();
        await loadPoolBalance();
        setShowDepositSuggestion(false);
        return response;
      } else {
        throw new Error(response.error || 'Deposit failed');
      }
    } catch (err) {
      console.error('Error depositing to pool:', err);
      throw err;
    }
  };

  const loadAddressSpoofing = async () => {
    try {
      const result = await chrome.storage.local.get(['addressSpoofing']);
      setAddressSpoofing(result.addressSpoofing || true);
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

  const openEtherscan = (address: string) => {
    const etherscanUrl = `https://sepolia.etherscan.io/address/${address}`;
    chrome.tabs.create({ url: etherscanUrl });
  };

  const loadExistingWallet = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getWalletInfo' });
      if (response && !response.error) {
        setWalletInfo(response);
        // Reload balance when wallet info changes
        loadMasterBalance();
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
        
        // Load balances and check if we should show deposit suggestion
        const masterBalanceResponse = await chrome.runtime.sendMessage({ type: 'getMasterBalance' });
        const poolBalanceResponse = await chrome.runtime.sendMessage({ type: 'getPoolBalance' });
        
        if (masterBalanceResponse && !masterBalanceResponse.error) {
          setMasterBalance(masterBalanceResponse.balance);
        }
        if (poolBalanceResponse && !poolBalanceResponse.error) {
          setPoolBalance(poolBalanceResponse.balance);
        }
        
        // Show deposit suggestion if user has no funds in pool but has wallet balance
        const poolBalanceNum = parseFloat(poolBalanceResponse?.balance || '0');
        const masterBalanceNum = parseFloat(masterBalanceResponse?.balance || '0');
        
        if (poolBalanceNum === 0 && masterBalanceNum > 0) {
          setShowDepositSuggestion(true);
        }
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
      <h2 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}>
        Welcome to PrivacyLinks
      </h2>
      
      {!walletInfo ? (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', color: '#666' }}>
              Enter 12-word PrivacyPools secret:
              <span
                title="For the demo, use a 12-word seed phrase with testnet funds"
                style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  lineHeight: '16px',
                  cursor: 'help',
                  userSelect: 'none'
                }}
              >
                ?
              </span>
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
            {isImporting ? 'Importing...' : 'Import Secret'}
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
              PrivacyLinks Wallet
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
                  <span
                    onClick={() => {
                      setShowSessionList(!showSessionList);
                      if (!showSessionList) {
                        loadSessionAddresses();
                      }
                    }}
                    style={{
                      fontSize: '11px',
                      color: '#6c757d',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      opacity: 0.8,
                      transition: 'opacity 0.2s, color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = '#495057';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                      e.currentTarget.style.color = '#6c757d';
                    }}
                  >
                    {showSessionList ? '△ hide' : '▽ show all'}
                  </span>
                </div>
                <div 
                  onClick={() => {
                    setShowSessionList(!showSessionList);
                    if (!showSessionList) {
                      loadSessionAddresses();
                    }
                  }}
                  style={{ 
                    marginTop: '5px',
                    wordBreak: 'break-all',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#155724',
                    backgroundColor: '#d4edda',
                    padding: '6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c3e6cb';
                    e.currentTarget.style.borderColor = '#b1dfbb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#d4edda';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  title="Click to toggle session list"
                >
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
                      Previous Sessions
                    </div>
                    {sessionAddresses.length > 0 ? (
                      sessionAddresses.map((session) => (
                        <div
                          key={session.sessionNumber}
                          onClick={() => {
                            if (!session.isCurrent) {
                              switchToSession(session.sessionNumber);
                            }
                          }}
                          style={{
                            padding: '8px',
                            borderBottom: '1px solid #dee2e6',
                            backgroundColor: session.isCurrent ? '#d4edda' : 'transparent',
                            transition: 'background-color 0.2s',
                            cursor: session.isCurrent ? 'default' : 'pointer'
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
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#6c757d', 
                            marginBottom: '2px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>Session #{session.sessionNumber} {session.isCurrent && '(Current)'}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEtherscan(session.address);
                                }}
                                style={{ 
                                  cursor: 'pointer', 
                                  color: '#007bff',
                                  fontSize: '10px',
                                  textDecoration: 'underline'
                                }}
                                title="View on Etherscan"
                              >
                                🔎
                              </span>
                            </div>
                          </div>
                          <div 
                            style={{
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              color: '#495057',
                              padding: '2px',
                              borderRadius: '2px'
                            }}
                            title={session.isCurrent ? "Current session" : "Click to switch to this session"}
                          >
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
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              Pool Balance: <strong style={{ color: '#007bff' }}>{poolBalance} ETH</strong>
            </div>
          </div>

          {/* Deposit Suggestion */}
          {showDepositSuggestion && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#e7f3ff',
              border: '2px solid #007bff',
              borderRadius: '8px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0056b3', fontSize: '14px' }}>
                💰 Deposit Suggestion
              </h4>
              <p style={{ fontSize: '12px', color: '#0056b3', margin: '0 0 15px 0' }}>
                To enable secure transactions, consider depositing some of your balance ({(parseFloat(masterBalance) * 0.5).toFixed(4)} ETH) to the Pool contract.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowDepositSuggestion(false)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Maybe Later
                </button>
                <button
                  onClick={async () => {
                    try {
                      const depositAmount = (parseFloat(masterBalance) * 0.5).toFixed(4);
                      await depositToPool(depositAmount);
                    } catch (error) {
                      console.error('Deposit failed:', error);
                      setError('Deposit failed. Please try again.');
                    }
                  }}
                  style={{
                    flex: 2,
                    padding: '8px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  Deposit 90% ({(parseFloat(masterBalance) * 0.9).toFixed(4)} ETH)
                </button>
              </div>
            </div>
          )}

          {/* Pay USDC Section */}
          <div style={{ 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {!showPayUSDC ? (
              <button
                onClick={() => setShowPayUSDC(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2775ca',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  boxShadow: '0 2px 8px rgba(39, 117, 202, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e5a96';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 117, 202, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2775ca';
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(39, 117, 202, 0.3)';
                }}
              >
                <img 
                  src="usdc-logo.png" 
                  alt="USDC" 
                  style={{ 
                    width: '20px', 
                    height: '20px',
                    borderRadius: '50%'
                  }} 
                />
                Pay
              </button>
            ) : (
              <div style={{
                padding: '20px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                textAlign: 'left'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ 
                    margin: 0, 
                    color: '#333', 
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <img 
                      src="usdc-logo.png" 
                      alt="USDC" 
                      style={{ 
                        width: '16px', 
                        height: '16px',
                        borderRadius: '50%'
                      }} 
                    />
                    Pay
                  </h4>
                  <span
                    onClick={() => setShowPayUSDC(false)}
                    style={{
                      cursor: 'pointer',
                      color: '#6c757d',
                      fontSize: '18px',
                      lineHeight: '1'
                    }}
                  >
                    ×
                  </span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Token Type
                  </label>
                  <select
                    value={paymentForm.tokenType}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      tokenType: e.target.value as "USDC" | "CCIP-BnM"
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="USDC">USDC</option>
                    <option value="CCIP-BnM">CCIP-BnM (Test Token)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={paymentForm.destinationAddress}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      destinationAddress: e.target.value
                    })}
                    placeholder="0x1234..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Amount ({paymentForm.tokenType})
                  </label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      amount: e.target.value
                    })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Destination Chain
                  </label>
                  <select
                    value={paymentForm.destinationChain}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      destinationChain: parseInt(e.target.value) as CCIPSupportedChainId
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value={CCIPSupportedChainId.ETH_SEPOLIA}>Ethereum Sepolia</option>
                    <option value={CCIPSupportedChainId.BASE_SEPOLIA}>Base Sepolia</option>
                    <option value={CCIPSupportedChainId.ARB_SEPOLIA}>Arbitrum Sepolia</option>
                    <option value={CCIPSupportedChainId.AVAX_FUJI}>Avalanche Fuji</option>
                    <option value={CCIPSupportedChainId.POLYGON_AMOY}>Polygon Amoy</option>
                    <option value={CCIPSupportedChainId.RONIN_SAIGON}>Ronin Saigon</option>
                  </select>
                </div>

                {!showPaymentOverview ? (
                  <button
                    onClick={() => {
                      setShowPaymentOverview(true);
                    }}
                    disabled={!paymentForm.destinationAddress || !paymentForm.amount}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: (!paymentForm.destinationAddress || !paymentForm.amount) ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (!paymentForm.destinationAddress || !paymentForm.amount) ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                      if (paymentForm.destinationAddress && paymentForm.amount) {
                        e.currentTarget.style.backgroundColor = '#0056b3';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (paymentForm.destinationAddress && paymentForm.amount) {
                        e.currentTarget.style.backgroundColor = '#007bff';
                      }
                    }}
                  >
                    Overview
                  </button>
                ) : (
                  <div>
                    {/* Payment Overview */}
                    <div style={{
                      backgroundColor: '#e7f3ff',
                      border: '1px solid #bee5eb',
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#0c5460' }}>
                        Payment Overview
                      </h5>
                      
                      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: '#6c757d' }}>To:</span>
                        <div style={{ 
                          fontFamily: 'monospace', 
                          wordBreak: 'break-all',
                          fontSize: '10px',
                          marginTop: '2px'
                        }}>
                          {paymentForm.destinationAddress}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: '#6c757d' }}>Amount:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '600' }}>
                          {paymentForm.amount} {paymentForm.tokenType}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: '#6c757d' }}>Chain:</span>
                        <span style={{ marginLeft: '8px' }}>
                          {CCIP_CHAIN_ID_TO_NAME[paymentForm.destinationChain] || 'Unknown Chain'}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '11px', marginBottom: '0' }}>
                        <span style={{ color: '#6c757d' }}>Estimated Cost:</span>
                        <span style={{ marginLeft: '8px', fontWeight: '600', color: '#dc3545' }}>
                          ~0.0023 ETH
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowPaymentOverview(false)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#545b62';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#6c757d';
                        }}
                      >
                        Back
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (!walletInfo?.currentSessionAddress) {
                            console.error('No session address available');
                            return;
                          }
                          
                          try {
                            // Get private key from background script
                            const response = await chrome.runtime.sendMessage({ type: 'getPrivateKey' });
                            if (response.error) {
                              console.error('Failed to get private key:', response.error);
                              return;
                            }
                            
                            // Fund session address if necessary
                            const fundResponse = await chrome.runtime.sendMessage({ 
                              type: 'fundSessionIfNeeded',
                              sessionAddress: walletInfo.currentSessionAddress,
                              requiredAmount: '0.01' // 0.01 ETH
                            });
                            
                            if (fundResponse.error) {
                              console.error('Failed to fund session:', fundResponse.error);
                              // Continue anyway, maybe the session has enough funds
                            }
                            
                            // Execute the CCIP cross-chain transfer
                            await executeCCIPTransfer(
                              response.privateKey,
                              CCIPSupportedChainId.ETH_SEPOLIA, // Source chain (assuming current session is on Sepolia)
                              paymentForm.destinationChain,
                              paymentForm.destinationAddress,
                              paymentForm.amount,
                              paymentForm.tokenType
                            );
                          } catch (error) {
                            console.error('Payment failed:', error);
                          }
                        }}
                        disabled={currentStep !== 'idle' && currentStep !== 'completed' && currentStep !== 'error'}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: (currentStep !== 'idle' && currentStep !== 'completed' && currentStep !== 'error') ? '#6c757d' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (currentStep !== 'idle' && currentStep !== 'completed' && currentStep !== 'error') ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => {
                          if (currentStep === 'idle' || currentStep === 'completed' || currentStep === 'error') {
                            e.currentTarget.style.backgroundColor = '#218838';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentStep === 'idle' || currentStep === 'completed' || currentStep === 'error') {
                            e.currentTarget.style.backgroundColor = '#28a745';
                          }
                        }}
                      >
                        {currentStep === 'idle' ? 'Confirm Payment' : 
                         currentStep === 'completed' ? 'Payment Complete' :
                         currentStep === 'error' ? 'Retry Payment' :
                         'Processing...'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment Status Display */}
                {(currentStep !== 'idle' || logs.length > 0) && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: currentStep === 'error' ? '#f8d7da' : '#e7f3ff',
                    border: `1px solid ${currentStep === 'error' ? '#f5c6cb' : '#bee5eb'}`,
                    borderRadius: '4px'
                  }}>
                    <h5 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '12px', 
                      color: currentStep === 'error' ? '#721c24' : '#0c5460',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      Payment Status
                      {(currentStep === 'completed' || currentStep === 'error') && (
                        <button
                          onClick={() => {
                            reset();
                            setShowPaymentOverview(false);
                          }}
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </h5>
                    
                    <div style={{ 
                      fontSize: '11px', 
                      color: currentStep === 'error' ? '#721c24' : '#0c5460',
                      marginBottom: '8px',
                      fontWeight: '600'
                    }}>
                      Current Step: {currentStep === 'idle' ? 'Ready' : 
                                   currentStep === 'approving-token' ? `Approving ${paymentForm.tokenType}` :
                                   currentStep === 'estimating-fees' ? 'Estimating CCIP Fees' :
                                   currentStep === 'transferring' ? 'Initiating CCIP Transfer' :
                                   currentStep === 'waiting-confirmation' ? 'Waiting for Confirmation' :
                                   currentStep === 'completed' ? '✅ Completed' :
                                   currentStep === 'error' ? '❌ Error' : currentStep}
                    </div>

                    {messageId && (
                      <div style={{
                        fontSize: '10px',
                        color: '#0c5460',
                        backgroundColor: '#e7f3ff',
                        border: '1px solid #bee5eb',
                        padding: '6px',
                        borderRadius: '3px',
                        marginBottom: '8px',
                        wordBreak: 'break-all'
                      }}>
                        <strong>CCIP Message ID:</strong><br />
                        {messageId}
                        <br />
                        <small>Track on <a href={`https://ccip.chain.link/msg/${messageId}`} target="_blank" rel="noopener noreferrer" style={{color: '#007bff'}}>CCIP Explorer</a></small>
                      </div>
                    )}

                    {transferError && (
                      <div style={{
                        fontSize: '10px',
                        color: '#721c24',
                        backgroundColor: '#f8d7da',
                        border: '1px solid #f5c6cb',
                        padding: '6px',
                        borderRadius: '3px',
                        marginBottom: '8px'
                      }}>
                        Error: {transferError}
                      </div>
                    )}

                    {logs.length > 0 && (
                      <div style={{
                        maxHeight: '120px',
                        overflowY: 'auto',
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                        padding: '6px',
                        borderRadius: '3px',
                        border: '1px solid rgba(0, 0, 0, 0.1)'
                      }}>
                        {logs.map((log: string, index: number) => (
                          <div key={index} style={{ marginBottom: '2px', lineHeight: '1.2' }}>
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transaction Progress */}
          {transactionProgress && (
            <div style={{ 
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: transactionProgress.status === 'error' ? '#f8d7da' : 
                              transactionProgress.status === 'completed' ? '#d4edda' : '#e7f3ff',
              border: `2px solid ${transactionProgress.status === 'error' ? '#dc3545' : 
                                   transactionProgress.status === 'completed' ? '#28a745' : '#007bff'}`,
              borderRadius: '8px'
            }}>
              <h4 style={{ 
                margin: '0 0 10px 0', 
                color: transactionProgress.status === 'error' ? '#721c24' : 
                       transactionProgress.status === 'completed' ? '#155724' : '#0056b3', 
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {transactionProgress.status === 'processing' && '⏳'}
                {transactionProgress.status === 'completed' && '✅'}
                {transactionProgress.status === 'error' && '❌'}
                Transaction Progress
              </h4>
              
              {/* Progress Bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                marginBottom: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(transactionProgress.currentStep / transactionProgress.totalSteps) * 100}%`,
                  height: '100%',
                  backgroundColor: transactionProgress.status === 'error' ? '#dc3545' : 
                                   transactionProgress.status === 'completed' ? '#28a745' : '#007bff',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              
              {/* Step Info */}
              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                <strong>Step {transactionProgress.currentStep}/{transactionProgress.totalSteps}:</strong> {transactionProgress.stepName}
              </div>
              
              {/* Transaction Hash */}
              {transactionProgress.txHash && (
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  <strong>Transaction:</strong>
                  <div style={{ 
                    fontFamily: 'monospace', 
                    wordBreak: 'break-all',
                    fontSize: '10px',
                    marginTop: '2px'
                  }}>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${transactionProgress.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#007bff', textDecoration: 'underline' }}
                    >
                      {transactionProgress.txHash}
                    </a>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {transactionProgress.error && (
                <div style={{ 
                  fontSize: '11px', 
                  color: '#721c24',
                  backgroundColor: '#f8d7da',
                  padding: '6px',
                  borderRadius: '3px',
                  border: '1px solid #f5c6cb'
                }}>
                  <strong>Error:</strong> {transactionProgress.error}
                </div>
              )}
            </div>
          )}

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
                <strong>🎭 Address Spoofing:</strong> Show fake rich address to dApps to enable actions.
              </label>
            </div>
          </div>
          
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