import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-air-density',
    version: '1.1.9',
    icon: '💨',
    title: 'Air Density',
    description: 'Displays air density calculated from temperature, pressure, and humidity.',
    author: 'Mare (lenient.fires_9q@icloud.com)',
    repository: 'https://github.com/Marvosg/windy-plugin-air-density/',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    routerPath: '/air-density',
    desktopWidth: 400,
};

export default config;
