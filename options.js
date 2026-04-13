import { PLATFORMS, defaultEnabledPlatforms } from './platforms.js';

const HA_ENTITY_DEFAULT = 'input_boolean.work_call_active';

async function load() {
  const sync = await chrome.storage.sync.get({ enabledPlatforms: defaultEnabledPlatforms() });
  const local = await chrome.storage.local.get({ haUrl: '', haToken: '', haEntity: HA_ENTITY_DEFAULT });

  document.getElementById('haUrl').value = local.haUrl;
  document.getElementById('haToken').value = local.haToken;
  document.getElementById('haEntity').value = local.haEntity || HA_ENTITY_DEFAULT;

  const container = document.getElementById('platforms');
  for (const platform of PLATFORMS) {
    const label = document.createElement('label');
    label.className = 'platform-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'platform';
    checkbox.value = platform.id;
    checkbox.checked = sync.enabledPlatforms.includes(platform.id);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(platform.name));
    container.appendChild(label);
  }
}

async function save() {
  const haUrl = document.getElementById('haUrl').value.trim().replace(/\/$/, '');
  const haToken = document.getElementById('haToken').value.trim();
  const haEntity = document.getElementById('haEntity').value.trim() || HA_ENTITY_DEFAULT;

  const enabledPlatforms = [...document.querySelectorAll('input[name="platform"]:checked')]
    .map(cb => cb.value);

  await chrome.storage.local.set({ haUrl, haToken, haEntity });
  await chrome.storage.sync.set({ enabledPlatforms });

  const status = document.getElementById('status');
  status.style.display = 'inline';
  setTimeout(() => { status.style.display = 'none'; }, 2000);
}

async function testConnection() {
  const haUrl = document.getElementById('haUrl').value.trim().replace(/\/$/, '');
  const haToken = document.getElementById('haToken').value.trim();
  const haEntity = document.getElementById('haEntity').value.trim() || HA_ENTITY_DEFAULT;

  const el = document.getElementById('testResult');
  el.textContent = 'Testing…';
  el.style.color = '#6b7280';
  el.style.display = 'inline';

  if (!haUrl || !haToken) {
    el.textContent = 'Enter URL and token first.';
    el.style.color = '#dc2626';
    return;
  }

  // Fetch via background service worker to avoid CORS preflight issues.
  const result = await chrome.runtime.sendMessage({
    type: 'TEST_HA_CONNECTION',
    haUrl,
    haToken,
    haEntity,
  });

  if (result.ok) {
    el.textContent = result.created ? 'Connected — entity created.' : 'Connected — entity already exists.';
    el.style.color = '#16a34a';
  } else if (result.error) {
    el.textContent = `Unreachable: ${result.error}`;
    el.style.color = '#dc2626';
  } else {
    el.textContent = `Error ${result.status}: ${result.statusText}`;
    el.style.color = '#dc2626';
  }
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('testBtn').addEventListener('click', testConnection);
load();
