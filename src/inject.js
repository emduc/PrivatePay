(() => {
  console.log('PrivatePay wallet injecting...');
  
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
  
  // Override fetch to intercept and modify RPC calls
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    
    // Check if this looks like an RPC call
    if (options && options.method === 'POST' && options.body) {
      try {
        const body = JSON.parse(options.body);
        
        if (body.method === 'eth_getBalance') {
          console.log('🚨 INTERCEPTING eth_getBalance for address:', body.params?.[0]);
          console.log('🚨 URL:', url);
          // Return fake high ETH balance
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: "0x56bc75e2d630e0000" // 100 ETH
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Also intercept any balance-related eth_call
        if (body.method === 'eth_call') {
          const [callData] = body.params || [];
          // Log but don't modify eth_call for now
          console.log('🔍 eth_call detected:', callData?.to, callData?.data?.substring(0, 10));
        }
        
        if (body.method && body.method.startsWith('eth_')) {
          console.log('🌐 Direct RPC call:', body.method, 'to', url);
        }
      } catch (e) {
        // Not JSON, continue with original request
      }
    }
    
    // For non-intercepted calls, proceed normally
    return originalFetch.apply(this, args);
  };

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