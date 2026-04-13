# Work Meeting Detector

A browser extension that detects when you're on a work call (Microsoft Teams, Slack Huddle, etc.) and updates a [Home Assistant](https://www.home-assistant.io/) sensor so you can trigger automations — like a light outside your office door — to let people know you're busy.

## How it works

The extension intercepts `getUserMedia` calls on configured platforms. When the microphone becomes active on an enabled platform, it updates an `input_boolean` in Home Assistant via the WebSocket API. When the call ends, it sets it back to off.

Platforms like Element (Matrix) that you may use for personal calls can be left disabled so they don't trigger the work automation.

## Features

- Detects mic activity on Teams, Slack, Google Meet, Zoom, and more
- Configurable per-platform toggles — enable only the platforms you use for work
- Updates Home Assistant automatically via WebSocket (no CORS configuration needed)
- Auto-creates the `input_boolean` entity on first use
- Watchdog alarm re-syncs state every 2 minutes if Home Assistant was unreachable
- Works across multiple browsers/devices independently without state conflicts

## Supported platforms

| Platform | Default |
|----------|---------|
| Microsoft Teams | ✅ Enabled |
| Slack | ✅ Enabled |
| Google Meet | ✅ Enabled |
| Zoom | ✅ Enabled |
| Cisco WebEx | Disabled |
| Discord | Disabled |
| Jitsi Meet | Disabled |
| Element (Matrix) | Disabled |

## Installation

This extension is not yet published to the Chrome Web Store. To install it manually:

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the repository folder

## Setup

1. Click the extension icon and choose **Settings** (or right-click the icon → *Options*)
2. Enter your Home Assistant URL and a [long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token)
3. Set the Entity ID (default: `input_boolean.work_call_active`)
4. Select which platforms should count as work meetings
5. Click **Test connection** — this verifies connectivity and creates the entity in HA if it doesn't exist yet
6. Click **Save**

The `input_boolean.work_call_active` entity will appear in Home Assistant and can be used as a trigger or condition in any automation.

## Home Assistant automation example

```yaml
automation:
  - alias: "Office busy light on"
    trigger:
      - platform: state
        entity_id: input_boolean.work_call_active
        to: "on"
    action:
      - service: light.turn_on
        target:
          entity_id: light.office_door

  - alias: "Office busy light off"
    trigger:
      - platform: state
        entity_id: input_boolean.work_call_active
        to: "off"
    action:
      - service: light.turn_off
        target:
          entity_id: light.office_door
```

## Multiple devices

Each browser instance manages its own mic state independently. If you use the extension on both a laptop and a desktop, they will not interfere with each other — a device only pushes state changes when its own mic activity changes.

## Technical notes

**Why WebSocket instead of the REST API?** The HA REST API requires CORS headers that HA doesn't send by default for browser extension origins. The WebSocket API has no such restriction, so no HA configuration is needed beyond the access token.

**Why `all_frames: true`?** Some platforms (notably Teams) run their WebRTC calling code inside a sandboxed iframe where `chrome.runtime` is unavailable. The extension injects into all frames and uses `postMessage` to bubble mic events from sandboxed frames up to the top-level frame.
