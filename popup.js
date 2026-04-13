// Popup can't import ES modules easily alongside non-module scripts,
// so platform names are resolved from storage directly.

async function render() {
  const { activeMicTabs = [] } = await chrome.storage.session.get('activeMicTabs');
  const active = activeMicTabs.length > 0;

  document.getElementById('dot').className = `dot ${active ? 'on' : 'off'}`;
  document.getElementById('label').textContent = active ? 'On a work call' : 'Not on a call';

  if (active) {
    // Read the platform attribute from HA state if available, otherwise skip.
    // Quick: just show tab count.
    const count = activeMicTabs.length;
    document.getElementById('platform').textContent =
      count === 1 ? '1 active tab' : `${count} active tabs`;
  }
}

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

render();
