// Runs in the ISOLATED world. Listens for CustomEvents from content_main.js
// and forwards them to the background service worker.
//
// In sandboxed iframes (e.g. Teams' WebRTC frame), chrome.runtime is unavailable.
// In that case we postMessage to the top frame, which relays to the background.

console.debug('[WMD] content_isolated injected', location.href);

function relay(type) {
  if (chrome.runtime?.sendMessage) {
    console.debug('[WMD] relaying', type, 'via chrome.runtime');
    chrome.runtime.sendMessage({ type });
  } else {
    // Sandboxed frame — bubble up to the top frame where chrome.runtime works.
    console.debug('[WMD] relaying', type, 'via postMessage to top');
    window.top.postMessage({ __wmd: type }, '*');
  }
}

document.addEventListener('__wmd_mic_started', () => relay('MIC_STARTED'));
document.addEventListener('__wmd_mic_stopped', () => relay('MIC_STOPPED'));

// Receive relayed messages from child frames and forward to background.
window.addEventListener('message', (event) => {
  const type = event.data?.__wmd;
  if (type === 'MIC_STARTED' || type === 'MIC_STOPPED') {
    console.debug('[WMD] received relayed', type, 'from child frame');
    chrome.runtime.sendMessage({ type });
  }
});
