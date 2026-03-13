'use strict';

const CONNECTED_BASE = 'https://api.volvocars.com/connected-vehicle/v2';
const ENERGY_BASE = 'https://api.volvocars.com/energy/v2';
const LOCATION_BASE = 'https://api.volvocars.com/location/v1';
const TOKEN_URL = 'https://volvoid.eu.volvocars.com/as/token.oauth2';

const CONNECTED_FAST_ENDPOINTS = [
    '/vehicles/{vin}/windows',
    '/vehicles/{vin}/warnings',
    '/vehicles/{vin}/tyres',
    '/vehicles/{vin}/statistics',
    '/vehicles/{vin}/odometer',
    '/vehicles/{vin}/fuel',
    '/vehicles/{vin}/engine',
    '/vehicles/{vin}/doors',
    '/vehicles/{vin}/diagnostics',
    '/vehicles/{vin}/command-accessibility',
    '/vehicles/{vin}/brakes',
    '/vehicles/{vin}/engine-status'
];

const CONNECTED_SLOW_ENDPOINTS = [
    '/vehicles',
    '/vehicles/{vin}',
    '/vehicles/{vin}/commands'
];

const ENERGY_FAST_ENDPOINTS = [
    '/vehicles/{vin}/state'
];

const ENERGY_SLOW_ENDPOINTS = [
    '/vehicles/{vin}/capabilities'
];

const LOCATION_FAST_ENDPOINTS = [
    '/vehicles/{vin}/location'
];

const COMMANDS = {
    lock: { command: 'LOCK', path: '/vehicles/{vin}/commands/lock', body: {} },
    unlock: { command: 'UNLOCK', path: '/vehicles/{vin}/commands/unlock', body: {} },
    honk: { command: 'HONK', path: '/vehicles/{vin}/commands/honk', body: {} },
    flash: { command: 'FLASH', path: '/vehicles/{vin}/commands/flash', body: {} },
    honkFlash: { command: 'HONK_AND_FLASH', path: '/vehicles/{vin}/commands/honk-flash', body: {} },
    lockReducedGuard: { command: 'LOCK_REDUCED_GUARD', path: '/vehicles/{vin}/commands/lock-reduced-guard', body: {} },
    engineStart: { command: 'ENGINE_START', path: '/vehicles/{vin}/commands/engine-start', bodyConfig: 'engineStartRuntimeMinutes' },
    engineStop: { command: 'ENGINE_STOP', path: '/vehicles/{vin}/commands/engine-stop', body: {} },
    climatizationStart: { command: 'CLIMATIZATION_START', path: '/vehicles/{vin}/commands/climatization-start', body: {} },
    climatizationStop: { command: 'CLIMATIZATION_STOP', path: '/vehicles/{vin}/commands/climatization-stop', body: {} }
};

module.exports = {
    CONNECTED_BASE,
    ENERGY_BASE,
    LOCATION_BASE,
    TOKEN_URL,
    CONNECTED_FAST_ENDPOINTS,
    CONNECTED_SLOW_ENDPOINTS,
    ENERGY_FAST_ENDPOINTS,
    ENERGY_SLOW_ENDPOINTS,
    LOCATION_FAST_ENDPOINTS,
    COMMANDS
};
