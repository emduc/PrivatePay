// Inject script file to avoid CSP issues
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
  this.remove();
};

// Inject before page loads
(document.head || document.documentElement).appendChild(script);

// Handle messages from the page
window.addEventListener('message', async (event) => {
  if (event.data.type === 'FROM_PAGE') {
    const { method, params, id } = event.data;
    
    try {
      let result;
      
      if (method === 'eth_requestAccounts') {
        result = await chrome.runtime.sendMessage({ type: 'connect' });
        result = result ? [result] : [];
      } else if (method === 'eth_accounts') {
        result = await chrome.runtime.sendMessage({ type: 'getAccounts' });
        result = result ? [result] : [];
      } else if (method === 'eth_chainId') {
        result = '0x1';
      } else if (method === 'net_version') {
        result = '1';
      } else if (method === 'personal_sign') {
        const [message, address] = params || [];
        result = await chrome.runtime.sendMessage({ 
          type: 'personalSign', 
          message, 
          address 
        });
      } else if (method === 'eth_sendTransaction') {
        const [txParams] = params || [];
        result = await chrome.runtime.sendMessage({ 
          type: 'sendTransaction', 
          txParams 
        });
      } else {
        throw new Error('Unsupported method: ' + method);
      }
      
      window.postMessage({
        type: 'FROM_CONTENT',
        method,
        result,
        id
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'FROM_CONTENT',
        method,
        error: error.message,
        id
      }, '*');
    }
  }
});