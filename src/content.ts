(() => {
  const ethereumProvider = {
    isMetaMask: false,
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      if (method === 'eth_requestAccounts') {
        const response = await chrome.runtime.sendMessage({ type: 'connect' });
        return response ? [response] : [];
      }
      if (method === 'eth_accounts') {
        const response = await chrome.runtime.sendMessage({ type: 'getAccounts' });
        return response ? [response] : [];
      }
      if (method === 'personal_sign') {
        const [message, address] = params || [];
        const response = await chrome.runtime.sendMessage({ 
          type: 'personalSign', 
          message, 
          address 
        });
        return response;
      }
      if (method === 'eth_sendTransaction') {
        const [txParams] = params || [];
        const response = await chrome.runtime.sendMessage({ 
          type: 'sendTransaction', 
          txParams 
        });
        return response;
      }
      throw new Error(`Unsupported method: ${method}`);
    }
  };

  (window as any).ethereum = ethereumProvider;
  
  const event = new CustomEvent('ethereum#initialized', {
    detail: ethereumProvider
  });
  window.dispatchEvent(event);
})();