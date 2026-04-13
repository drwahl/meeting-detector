// HA WebSocket client. Opens a connection per call — no persistent socket needed
// since MV3 service workers are ephemeral anyway.

const TIMEOUT_MS = 10000;

function toWsUrl(haUrl) {
  return haUrl.replace(/^http/, 'ws') + '/api/websocket';
}

function haWS(haUrl, haToken, type, payload = {}) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(toWsUrl(haUrl));
    } catch {
      reject(new Error('Invalid HA URL'));
      return;
    }

    const cmdId = 1;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timed out'));
    }, TIMEOUT_MS);

    ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: haToken }));
      } else if (msg.type === 'auth_ok') {
        ws.send(JSON.stringify({ id: cmdId, type, ...payload }));
      } else if (msg.type === 'auth_invalid') {
        clearTimeout(timer);
        ws.close();
        reject(new Error('Invalid access token'));
      } else if (msg.type === 'result' && msg.id === cmdId) {
        clearTimeout(timer);
        ws.close();
        if (msg.success) {
          resolve(msg.result);
        } else {
          const err = new Error(msg.error?.message ?? 'HA error');
          err.code = msg.error?.code;
          reject(err);
        }
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Could not connect — check HA URL'));
    };
  });
}

async function doCallService(haUrl, haToken, entityId, on) {
  await haWS(haUrl, haToken, 'call_service', {
    domain: 'input_boolean',
    service: on ? 'turn_on' : 'turn_off',
    service_data: { entity_id: entityId },
  });
}

export async function callService(haUrl, haToken, entityId, on) {
  try {
    await doCallService(haUrl, haToken, entityId, on);
  } catch {
    // Entity may not exist yet — create it and retry once.
    await ensureInputBoolean(haUrl, haToken, entityId);
    await doCallService(haUrl, haToken, entityId, on);
  }
}

// Creates the input_boolean only if it doesn't already exist.
async function ensureInputBoolean(haUrl, haToken, entityId) {
  const list = await haWS(haUrl, haToken, 'input_boolean/list');
  const exists = list.some(item => `input_boolean.${item.id}` === entityId);
  if (exists) return false;

  const objectId = entityId.replace(/^input_boolean\./, '');
  const name = objectId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  await haWS(haUrl, haToken, 'input_boolean/create', { name });
  return true;
}

// Called by the options page test button via background message.
export async function testAndEnsure(haUrl, haToken, entityId) {
  try {
    const created = await ensureInputBoolean(haUrl, haToken, entityId);
    await callService(haUrl, haToken, entityId, false); // verify round-trip works
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
