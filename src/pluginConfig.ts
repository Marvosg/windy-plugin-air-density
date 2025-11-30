import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-air-density',
    version: '1.0.9',
    icon: '💨',
    title: 'Air Density Layer',
    description: 'Displays air density as a colored grid layer calculated from temperature, pressure, and humidity.',
    author: 'Windy Plugin Developer',
    repository: 'https://github.com/windycom/windy-plugin-template',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    routerPath: '/air-density',
    desktopWidth: 400,
};

export default config;
