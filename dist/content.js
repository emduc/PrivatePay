"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content.ts
  var require_content = __commonJS({
    "src/content.ts"() {
      (() => {
        const ethereumProvider = {
          isMetaMask: false,
          request: async ({ method, params }) => {
            if (method === "eth_requestAccounts") {
              const response = await chrome.runtime.sendMessage({ type: "connect" });
              return response ? [response] : [];
            }
            if (method === "eth_accounts") {
              const response = await chrome.runtime.sendMessage({ type: "getAccounts" });
              return response ? [response] : [];
            }
            if (method === "personal_sign") {
              const [message, address] = params || [];
              const response = await chrome.runtime.sendMessage({
                type: "personalSign",
                message,
                address
              });
              return response;
            }
            if (method === "eth_sendTransaction") {
              const [txParams] = params || [];
              const response = await chrome.runtime.sendMessage({
                type: "sendTransaction",
                txParams
              });
              return response;
            }
            throw new Error(`Unsupported method: ${method}`);
          }
        };
        window.ethereum = ethereumProvider;
        const event = new CustomEvent("ethereum#initialized", {
          detail: ethereumProvider
        });
        window.dispatchEvent(event);
      })();
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
