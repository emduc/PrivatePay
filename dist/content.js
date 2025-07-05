"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content.ts
  var require_content = __commonJS({
    "src/content.ts"() {
      var script = document.createElement("script");
      script.src = chrome.runtime.getURL("inject.js");
      script.onload = function() {
        script.remove();
      };
      (document.head || document.documentElement).appendChild(script);
      window.addEventListener("message", async (event) => {
        if (event.data.type === "FROM_PAGE") {
          const { method, params, id } = event.data;
          try {
            let result;
            if (method === "eth_requestAccounts") {
              result = await chrome.runtime.sendMessage({ type: "connect" });
              result = result ? [result] : [];
            } else if (method === "eth_accounts") {
              result = await chrome.runtime.sendMessage({ type: "getAccounts" });
              result = result ? [result] : [];
            } else if (method === "eth_chainId") {
              result = await chrome.runtime.sendMessage({ type: "getChainId" });
            } else if (method === "net_version") {
              result = await chrome.runtime.sendMessage({ type: "getNetworkVersion" });
            } else if (method === "personal_sign") {
              const [message, address] = params || [];
              result = await chrome.runtime.sendMessage({
                type: "personalSign",
                message,
                address
              });
            } else if (method === "eth_sendTransaction") {
              const [txParams] = params || [];
              console.log("\u{1F4E8} eth_sendTransaction called from dApp:", txParams);
              console.log("\u23F0 Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
              result = await chrome.runtime.sendMessage({
                type: "sendTransaction",
                txParams
              });
              console.log("\u{1F4EC} Background response:", result);
              if (result && typeof result === "string" && result.startsWith("0x")) {
                console.log("\u{1F517} Transaction hash received:", result);
                console.log("\u{1F50D} View on Etherscan:", `https://sepolia.etherscan.io/tx/${result}`);
              }
            } else if (method === "wallet_switchEthereumChain") {
              const [{ chainId }] = params || [{}];
              console.log("Switching to chain:", chainId);
              result = await chrome.runtime.sendMessage({
                type: "switchChain",
                chainId
              });
            } else if (method === "eth_getBalance") {
              const [address, blockTag] = params || [];
              console.log("\u{1F4B0} eth_getBalance requested for:", address, "at block:", blockTag);
              result = await chrome.runtime.sendMessage({
                type: "getBalance",
                address,
                blockTag
              });
            } else if (method === "wallet_addEthereumChain") {
              result = null;
            } else if (method === "wallet_requestPermissions") {
              result = [{ parentCapability: "eth_accounts" }];
            } else if (method === "wallet_getPermissions") {
              result = [{ parentCapability: "eth_accounts" }];
            } else if (method === "eth_blockNumber") {
              result = "0x1234567";
            } else if (method === "eth_gasPrice") {
              result = "0x2540be400";
            } else if (method === "eth_estimateGas") {
              const [txParams] = params || [];
              const hasData = txParams?.data && txParams.data !== "0x";
              result = hasData ? "0x30d40" : "0x5208";
            } else if (method === "eth_getTransactionCount") {
              result = "0x1";
            } else if (method === "eth_getCode") {
              result = "0x";
            } else {
              console.log("Unsupported method called:", method, params);
              throw new Error("Unsupported method: " + method);
            }
            window.postMessage({
              type: "FROM_CONTENT",
              method,
              result,
              id
            }, "*");
          } catch (error) {
            window.postMessage({
              type: "FROM_CONTENT",
              method,
              error: error instanceof Error ? error.message : String(error),
              id
            }, "*");
          }
        }
      });
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
