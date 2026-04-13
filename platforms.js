// Canonical list of supported platforms.
// Imported as an ES module by background.js and options.js.
// content_scripts in manifest.json must stay in sync with the hostnames here.

export const PLATFORMS = [
  {
    id: 'teams',
    name: 'Microsoft Teams',
    hostname: 'teams.microsoft.com',
    defaultEnabled: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    hostname: 'app.slack.com',
    defaultEnabled: true,
  },
  {
    id: 'meet',
    name: 'Google Meet',
    hostname: 'meet.google.com',
    defaultEnabled: true,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    hostname: 'zoom.us',
    defaultEnabled: true,
  },
  {
    id: 'webex',
    name: 'Cisco WebEx',
    hostname: 'web.webex.com',
    defaultEnabled: false,
  },
  {
    id: 'discord',
    name: 'Discord',
    hostname: 'discord.com',
    defaultEnabled: false,
  },
  {
    id: 'jitsi',
    name: 'Jitsi Meet',
    hostname: 'meet.jit.si',
    defaultEnabled: false,
  },
  {
    id: 'element',
    name: 'Element (Matrix)',
    hostname: 'app.element.io',
    defaultEnabled: false,
  },
];

export function defaultEnabledPlatforms() {
  return PLATFORMS.filter(p => p.defaultEnabled).map(p => p.id);
}
