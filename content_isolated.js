// Runs in the ISOLATED world. Listens for CustomEvents from content_main.js
// and forwards them to the background service worker.

document.addEventListener('__wmd_mic_started', () => {
  chrome.runtime.sendMessage({ type: 'MIC_STARTED' });
});

document.addEventListener('__wmd_mic_stopped', () => {
  chrome.runtime.sendMessage({ type: 'MIC_STOPPED' });
});
