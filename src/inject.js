(() => {
  console.log('🔥 PrivatePay wallet injecting at:', Date.now());
  console.log('🔍 Current fetch function:', typeof window.fetch);
  console.log('🔍 Current XMLHttpRequest:', typeof window.XMLHttpRequest);
  
  let currentChainId = '0xaa36a7'; // Start with Sepolia
  let currentNetworkVersion = '11155111';
  
  const ethereumProvider = {
    isMetaMask: true,
    isConnected: () => true,
    get chainId() { return currentChainId; },
    get networkVersion() { return currentNetworkVersion; },
    selectedAddress: null,
    _metamask: {
      isUnlocked: () => Promise.resolve(true)
    },
    _state: {
      accounts: [],
      isConnected: true,
      isUnlocked: true,
      initialized: true,
      isPermanentlyDisconnected: false
    },
    
    request: async ({ method, params }) => {
      console.log('🔍 PrivatePay intercepted:', method, params);
      
      // Special logging for balance requests
      if (method === 'eth_getBalance') {
        console.log('💰 BALANCE REQUEST INTERCEPTED:', params);
      }
      
      return new Promise((resolve, reject) => {
        window.postMessage({
          type: 'FROM_PAGE',
          method,
          params,
          id: Date.now()
        }, '*');
        
        const listener = (event) => {
          if (event.data.type === 'FROM_CONTENT' && event.data.method === method) {
            window.removeEventListener('message', listener);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              if (method === 'eth_requestAccounts' && event.data.result) {
                ethereumProvider.selectedAddress = event.data.result;
              }
              resolve(event.data.result);
            }
          }
        };
        
        window.addEventListener('message', listener);
      });
    },
    
    on: (event, _callback) => {
      console.log('Event listener added:', event);
      return ethereumProvider;
    },
    
    removeListener: (event, _callback) => {
      console.log('Event listener removed:', event);
      return ethereumProvider;
    },
    
    emit: (event, ...args) => {
      console.log('Event emitted:', event, args);
    }
  };

  // Override any existing ethereum provider
  Object.defineProperty(window, 'ethereum', {
    value: ethereumProvider,
    writable: false,
    configurable: false
  });
  
  // Also set common MetaMask globals
  window.web3 = { currentProvider: ethereumProvider };
  
  console.log('PrivatePay wallet injected!', window.ethereum);
  
  // Prevent MetaMask app redirects by intercepting clicks
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.href && target.href.includes('metamask://')) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Blocked MetaMask app redirect, using PrivatePay instead');
      return false;
    }
  }, true);
  
  console.log('🎭 Address spoofing feature available - use wallet toggle to enable');

  // Dispatch events that dApps listen for
  window.dispatchEvent(new Event('ethereum#initialized'));
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: {
      info: {
        uuid: 'privatepay-wallet',
        name: 'PrivatePay',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMDA3YmZmIi8+PC9zdmc+',
        rdns: 'com.privatepay.wallet'
      },
      provider: ethereumProvider
    }
  }));
})();