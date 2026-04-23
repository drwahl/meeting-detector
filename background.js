import { PLATFORMS, defaultEnabledPlatforms } from './platforms.js';
import { callService, testAndEnsure } from './ha.js';

console.log('[WMD] background service worker started');

const HA_ENTITY_DEFAULT = 'input_boolean.work_call_active';

// --- Startup cleanup ---
// MV3 service workers are killed and restarted frequently. On restart,
// activeMicTabs may contain tab IDs that no longer exist. Purge dead tabs
// so the watchdog doesn't keep pushing ON for a call that ended.

(async () => {
  const tabs = await getActiveTabs();
  if (tabs.size === 0) return;

  const liveTabs = await chrome.tabs.query({});
  const liveIds = new Set(liveTabs.map(t => t.id));
  let changed = false;
  for (const id of tabs) {
    if (!liveIds.has(id)) { tabs.delete(id); changed = true; }
  }

  if (!changed) return;
  console.log('[WMD] startup: purged dead tabs from activeMicTabs');
  await setActiveTabs(tabs);
  await updateHA(tabs.size > 0, null);
  await syncWatchdog(tabs.size > 0);
})();

// --- Storage helpers ---

async function getSettings() {
  const sync = await chrome.storage.sync.get({ enabledPlatforms: defaultEnabledPlatforms() });
  const local = await chrome.storage.local.get({ haUrl: '', haToken: '', haEntity: HA_ENTITY_DEFAULT });
  return { ...sync, ...local };
}

async function getActiveTabs() {
  const { activeMicTabs = [] } = await chrome.storage.session.get('activeMicTabs');
  return new Set(activeMicTabs);
}

async function setActiveTabs(tabs) {
  await chrome.storage.session.set({ activeMicTabs: [...tabs] });
}

// --- HA update ---

async function updateHA(active, platformId) {
  const { haUrl, haToken, haEntity } = await getSettings();
  if (!haUrl || !haToken) {
    console.warn('[WMD] Home Assistant not configured — skipping update.');
    return;
  }
  try {
    await callService(haUrl, haToken, haEntity, active);
    console.log(`[WMD] HA → ${active ? 'ON' : 'OFF'}${platformId ? ` (${platformId})` : ''}`);
  } catch (e) {
    console.error('[WMD] HA update failed:', e.message);
  }
}

// --- Watchdog alarm ---
// While a call is active, re-push state to HA every 2 minutes.
// This self-heals any updates dropped during a HA outage.

const WATCHDOG_ALARM = 'wmd_watchdog';
const WATCHDOG_PERIOD_MINUTES = 2;

async function syncWatchdog(active) {
  if (active) {
    chrome.alarms.create(WATCHDOG_ALARM, { periodInMinutes: WATCHDOG_PERIOD_MINUTES });
  } else {
    chrome.alarms.clear(WATCHDOG_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== WATCHDOG_ALARM) return;
  (async () => {
    const tabs = await getActiveTabs();
    await updateHA(tabs.size > 0, null);
  })();
});

// --- Hostname → platform lookup ---

function hostnameToId(hostname) {
  return PLATFORMS.find(p => p.hostname === hostname)?.id ?? null;
}

function isEnabled(platformId, enabledPlatforms) {
  return enabledPlatforms.includes(platformId);
}

// --- MIC_STARTED debounce ---
// Many platforms (Teams, Slack) call getUserMedia for background probes
// (noise cancellation init, permission checks) that end within seconds.
// Wait before treating a MIC_STARTED as an active call; if MIC_STOPPED
// arrives within the window, it was a probe — ignore it.

const DEBOUNCE_MS = 5000;
const pendingStarts = new Map(); // tabId → { timer, platformId }

function cancelPendingStart(tabId) {
  const pending = pendingStarts.get(tabId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingStarts.delete(tabId);
    return true;
  }
  return false;
}

async function confirmTabActive(tabId, platformId) {
  pendingStarts.delete(tabId);
  const tabs = await getActiveTabs();
  tabs.add(tabId);
  await setActiveTabs(tabs);
  await updateHA(true, platformId);
  await syncWatchdog(true);
}

// --- Message handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEST_HA_CONNECTION') {
    testAndEnsure(message.haUrl, message.haToken, message.haEntity).then(sendResponse);
    return true; // keep channel open for async response
  }

  const tabId = sender.tab?.id;
  const tabUrl = sender.tab?.url;
  if (!tabId || !tabUrl) return;

  (async () => {
    const { enabledPlatforms } = await getSettings();
    const hostname = new URL(tabUrl).hostname;
    const platformId = hostnameToId(hostname);

    if (!platformId || !isEnabled(platformId, enabledPlatforms)) return;

    if (message.type === 'MIC_STARTED') {
      cancelPendingStart(tabId); // reset if already pending
      const timer = setTimeout(() => confirmTabActive(tabId, platformId), DEBOUNCE_MS);
      pendingStarts.set(tabId, { timer, platformId });

    } else if (message.type === 'MIC_STOPPED') {
      if (cancelPendingStart(tabId)) {
        // Was still in debounce window — just a probe, nothing to update
        console.log(`[WMD] MIC_STOPPED within debounce window (${platformId}) — ignoring probe`);
        return;
      }
      const tabs = await getActiveTabs();
      if (!tabs.has(tabId)) return;
      tabs.delete(tabId);
      await setActiveTabs(tabs);
      await updateHA(tabs.size > 0, null);
      await syncWatchdog(tabs.size > 0);
    }
  })();
});

// --- Tab lifecycle cleanup ---

chrome.tabs.onRemoved.addListener((tabId) => {
  cancelPendingStart(tabId);
  (async () => {
    const tabs = await getActiveTabs();
    if (!tabs.has(tabId)) return;
    tabs.delete(tabId);
    await setActiveTabs(tabs);
    await updateHA(tabs.size > 0, null);
    await syncWatchdog(tabs.size > 0);
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  (async () => {
    cancelPendingStart(tabId);
    const tabs = await getActiveTabs();
    if (!tabs.has(tabId)) return;
    try {
      const { hostname } = new URL(changeInfo.url);
      const knownHostnames = PLATFORMS.map(p => p.hostname);
      if (!knownHostnames.includes(hostname)) {
        tabs.delete(tabId);
        await setActiveTabs(tabs);
        await updateHA(tabs.size > 0, null);
        await syncWatchdog(tabs.size > 0);
      }
    } catch (_) {}
  })();
});
