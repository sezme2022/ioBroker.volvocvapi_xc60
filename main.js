'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');

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

class VolvoCvApiPro extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'volvocvapi_xc60' });
        this.client = axios.create({ timeout: 30000, validateStatus: () => true });
        this.pollTimer = null;
        this.pollCount = 0;
        this.tokenCache = {
            accessToken: '',
            refreshToken: '',
            expiresAt: 0
        };
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        try {
            await this.createInfoStates();
            await this.createCommandStates();
            await this.loadTokenCache();

            if (!this.config.apiKey) {
                throw new Error('Missing VCC API key');
            }

            await this.ensureToken();
            await this.pollOnce();
            const pollMs = Math.max(300, Number(this.config.pollIntervalSec) || 300) * 1000;
            this.pollTimer = setInterval(() => {
                this.pollOnce().catch(err => this.log.error(`Polling failed: ${err.message}`));
            }, pollMs);
        } catch (error) {
            this.log.error(`Startup failed: ${error.message}`);
        }
    }

    async onUnload(callback) {
        try {
            if (this.pollTimer) clearInterval(this.pollTimer);
            callback();
        } catch {
            callback();
        }
    }

    async createInfoStates() {
        const defs = {
            'info.connection': { type: 'boolean', role: 'indicator.connected', def: false },
            'info.lastUpdate': { type: 'string', role: 'text' },
            'info.lastError': { type: 'string', role: 'text' },
            'info.selectedVin': { type: 'string', role: 'text' },
            'info.tokenExpiresAt': { type: 'string', role: 'text' },
            'info.commandAccessibility': { type: 'string', role: 'text' },
            'info.supportedCommands': { type: 'string', role: 'json' }
        };
        for (const [id, common] of Object.entries(defs)) {
            await this.extendObjectAsync(id, {
                type: 'state',
                common: {
                    name: id,
                    read: true,
                    write: false,
                    ...common
                },
                native: {}
            });
        }
        await this.setState('info.connection', false, true);
    }

    async createCommandStates() {
        await this.extendObjectAsync('commands', { type: 'channel', common: { name: 'Commands' }, native: {} });
        await this.extendObjectAsync('commandsLastResult', { type: 'channel', common: { name: 'Command results' }, native: {} });
        await this.extendObjectAsync('availableCommands', { type: 'channel', common: { name: 'Available commands' }, native: {} });

        for (const [commandName, commandInfo] of Object.entries(COMMANDS)) {
            await this.extendObjectAsync(`commands.${commandName}`, {
                type: 'state',
                common: { name: commandName, type: 'boolean', role: 'button', read: false, write: true, def: false },
                native: {}
            });
            await this.extendObjectAsync(`commandsLastResult.${commandName}`, {
                type: 'state',
                common: { name: `${commandName} result`, type: 'string', role: 'json', read: true, write: false },
                native: {}
            });
            await this.extendObjectAsync(`availableCommands.${commandName}`, {
                type: 'state',
                common: { name: `${commandInfo.command} supported`, type: 'boolean', role: 'indicator', read: true, write: false, def: false },
                native: {}
            });
            await this.setState(`availableCommands.${commandName}`, false, true);
        }
    }

    async loadTokenCache() {
        const accessToken = (this.config.accessToken || '').trim();
        const refreshToken = (this.config.refreshToken || '').trim();
        this.tokenCache.accessToken = accessToken;
        this.tokenCache.refreshToken = refreshToken;
    }

    getBasicAuthHeader() {
        if (!this.config.clientId || !this.config.clientSecret) {
            throw new Error('clientId/clientSecret missing');
        }
        const encoded = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        return `Basic ${encoded}`;
    }

    async ensureToken() {
        const now = Date.now();
        if (this.tokenCache.accessToken && this.tokenCache.expiresAt && (this.tokenCache.expiresAt - now > 120000)) {
            return;
        }
        if (!this.tokenCache.accessToken && this.config.authCode) {
            await this.exchangeAuthCode();
            return;
        }
        if (this.tokenCache.refreshToken && this.config.clientId && this.config.clientSecret) {
            await this.refreshToken();
            return;
        }
        if (!this.tokenCache.accessToken) {
            throw new Error('No usable access token configured. Set accessToken or refreshToken + clientId/clientSecret.');
        }
    }

    async exchangeAuthCode() {
        const redirectUri = (this.config.redirectUri || '').trim();
        if (!redirectUri) throw new Error('redirectUri missing for auth code exchange');

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: this.config.authCode,
            redirect_uri: redirectUri
        });

        if (this.config.codeVerifier) {
            body.set('code_verifier', this.config.codeVerifier);
        }

        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                authorization: this.getBasicAuthHeader()
            },
            timeout: 30000
        });

        this.applyTokenResponse(response.data, 'authorization_code');
        this.log.info('Authorization code exchanged successfully');
    }

    async refreshToken() {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.tokenCache.refreshToken
        });

        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                authorization: this.getBasicAuthHeader()
            },
            timeout: 30000
        });

        this.applyTokenResponse(response.data, 'refresh_token');
    }

    async applyTokenResponse(data, source) {
        if (!data || !data.access_token) {
            throw new Error(`Token request failed during ${source}`);
        }
        this.tokenCache.accessToken = data.access_token;
        if (data.refresh_token) this.tokenCache.refreshToken = data.refresh_token;
        const expiresInSec = Number(data.expires_in || 3600);
        this.tokenCache.expiresAt = Date.now() + Math.max(60, expiresInSec - 60) * 1000;
        await this.setState('info.tokenExpiresAt', new Date(this.tokenCache.expiresAt).toISOString(), true);
    }

    async onStateChange(id, state) {
        if (!state || state.ack) return;
        const prefix = `${this.namespace}.commands.`;
        if (!id.startsWith(prefix)) return;

        const commandName = id.substring(prefix.length);
        if (!(commandName in COMMANDS)) return;

        try {
            await this.ensureToken();
            const vin = await this.getSelectedVin();
            if (!vin) throw new Error('No VIN available');

            const isSupported = await this.getStateAsync(`availableCommands.${commandName}`);
            if (isSupported && isSupported.val === false) {
                throw new Error(`Command ${commandName} is currently not listed as supported by the vehicle`);
            }

            const cmd = COMMANDS[commandName];
            let body = cmd.body || {};
            if (cmd.bodyConfig) {
                body = { runtimeMinutes: Number(this.config[cmd.bodyConfig] || 10) };
            }

            const response = await this.apiRequest(CONNECTED_BASE, 'post', cmd.path.replace('{vin}', encodeURIComponent(vin)), body);
            await this.writeJsonState(`commandsLastResult.${commandName}`, response);
            await this.setState(`commands.${commandName}`, false, true);
            this.log.info(`Command ${commandName} executed with HTTP ${response.__httpStatus || 'n/a'}`);
        } catch (error) {
            await this.setState(`commands.${commandName}`, false, true);
            this.log.error(`Command ${commandName} failed: ${error.message}`);
        }
    }

    async getSelectedVin() {
        const configuredVin = (this.config.vin || '').trim();
        if (configuredVin) return configuredVin;

        const rawVehicles = await this.getStateAsync('raw.connected.vehicles');
        if (rawVehicles && rawVehicles.val) {
            try {
                const data = JSON.parse(rawVehicles.val);
                return this.extractFirstVin(data);
            } catch {
                // ignore
            }
        }

        const listResponse = await this.apiRequest(CONNECTED_BASE, 'get', '/vehicles');
        const vin = this.extractFirstVin(listResponse);
        return vin || null;
    }

    extractFirstVin(data) {
        if (!data || typeof data !== 'object') return null;
        if (Array.isArray(data?.data) && data.data[0]?.vin) return data.data[0].vin;
        if (Array.isArray(data?.vehicles) && data.vehicles[0]?.vin) return data.vehicles[0].vin;
        if (Array.isArray(data) && data[0]?.vin) return data[0].vin;
        if (typeof data.vin === 'string') return data.vin;
        return null;
    }

    async pollOnce() {
        this.pollCount += 1;
        try {
            await this.ensureToken();
            const fetchSlow = this.pollCount === 1 || this.pollCount % Math.max(1, Number(this.config.slowCycleCount) || 12) === 1;

            let vehicleList = null;
            try {
                vehicleList = await this.apiRequest(CONNECTED_BASE, 'get', '/vehicles');
                await this.writeJsonState('raw.connected.vehicles', vehicleList);
                await this.flattenIntoStates('connected.vehicles', vehicleList);
            } catch (error) {
                this.log.warn(`Vehicle list failed: ${error.message}`);
            }

            const vin = (this.config.vin || this.extractFirstVin(vehicleList) || '').trim();
            if (!vin) throw new Error('No VIN found');
            await this.setState('info.selectedVin', vin, true);

            await this.pollConnected(vin, fetchSlow);
            if (this.config.enableEnergy !== false) {
                await this.pollEnergy(vin, fetchSlow);
            }
            if (this.config.enableLocation !== false) {
                await this.pollLocation(vin);
            }

            await this.setState('info.connection', true, true);
            await this.setState('info.lastUpdate', new Date().toISOString(), true);
            await this.setState('info.lastError', '', true);
        } catch (error) {
            await this.setState('info.connection', false, true);
            await this.setState('info.lastError', error.message, true);
            throw error;
        }
    }

    async pollConnected(vin, fetchSlow) {
        const endpoints = [
            ...CONNECTED_FAST_ENDPOINTS,
            ...(fetchSlow ? CONNECTED_SLOW_ENDPOINTS : [])
        ];

        for (const endpoint of endpoints) {
            const path = endpoint.replace('{vin}', encodeURIComponent(vin));
            const prefix = `connected.${this.endpointToStatePrefix(endpoint)}`;
            try {
                const response = await this.apiRequest(CONNECTED_BASE, 'get', path);
                await this.flattenIntoStates(prefix, response);
                if (this.config.includeRawJson) {
                    await this.writeJsonState(`raw.${prefix}`, response);
                }
                if (endpoint === '/vehicles/{vin}/commands') {
                    await this.updateAvailableCommands(response);
                }
                if (endpoint === '/vehicles/{vin}/command-accessibility') {
                    const status = response?.data?.availabilityStatus?.value || response?.availabilityStatus?.value || '';
                    await this.setState('info.commandAccessibility', String(status), true);
                }
            } catch (error) {
                this.log.warn(`Connected endpoint ${endpoint} failed: ${error.message}`);
            }
        }
    }

    async pollEnergy(vin, fetchSlow) {
        const endpoints = [
            ...ENERGY_FAST_ENDPOINTS,
            ...(fetchSlow ? ENERGY_SLOW_ENDPOINTS : [])
        ];

        for (const endpoint of endpoints) {
            const path = endpoint.replace('{vin}', encodeURIComponent(vin));
            const prefix = `energy.${this.endpointToStatePrefix(endpoint)}`;
            try {
                const response = await this.apiRequest(ENERGY_BASE, 'get', path);
                await this.flattenIntoStates(prefix, response);
                if (this.config.includeRawJson) {
                    await this.writeJsonState(`raw.${prefix}`, response);
                }
            } catch (error) {
                this.log.warn(`Energy endpoint ${endpoint} failed: ${error.message}`);
            }
        }
    }

    async pollLocation(vin) {
        for (const endpoint of LOCATION_FAST_ENDPOINTS) {
            const path = endpoint.replace('{vin}', encodeURIComponent(vin));
            const prefix = `location.${this.endpointToStatePrefix(endpoint)}`;
            try {
                const response = await this.apiRequest(LOCATION_BASE, 'get', path);
                await this.flattenIntoStates(prefix, response);
                if (this.config.includeRawJson) {
                    await this.writeJsonState(`raw.${prefix}`, response);
                }
            } catch (error) {
                this.log.warn(`Location endpoint ${endpoint} failed: ${error.message}`);
            }
        }
    }

    async updateAvailableCommands(response) {
        const data = Array.isArray(response?.data) ? response.data : [];
        const commandSet = new Set(data.map(item => item.command).filter(Boolean));
        await this.setState('info.supportedCommands', JSON.stringify([...commandSet]), true);

        for (const [stateName, commandInfo] of Object.entries(COMMANDS)) {
            await this.setState(`availableCommands.${stateName}`, commandSet.has(commandInfo.command), true);
        }
    }

    endpointToStatePrefix(endpoint) {
        return endpoint
            .replace('/vehicles/{vin}', 'vehicle')
            .replace('/vehicles', 'vehicles')
            .replace(/\//g, '.')
            .replace(/\.+/g, '.')
            .replace(/^\./, '')
            .replace(/\.$/, '');
    }

    async apiRequest(baseUrl, method, path, data) {
        const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
        const response = await this.client.request({
            method,
            url,
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: `Bearer ${this.tokenCache.accessToken}`,
                'vcc-api-key': this.config.apiKey
            },
            data
        });

        if (response.status === 401 && this.tokenCache.refreshToken && this.config.clientId && this.config.clientSecret) {
            await this.refreshToken();
            return this.apiRequest(baseUrl, method, path, data);
        }

        let body = response.data;
        if (typeof body !== 'object' || body === null) {
            body = { value: body };
        }
        body.__httpStatus = response.status;

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
        }
        return body;
    }

    async writeJsonState(id, value) {
        await this.extendObjectAsync(id, {
            type: 'state',
            common: { name: id, type: 'string', role: 'json', read: true, write: false },
            native: {}
        });
        await this.setState(id, JSON.stringify(value), true);
    }

    async flattenIntoStates(prefix, value) {
        const entries = [];
        this.flatten(prefix, value, entries);
        for (const entry of entries) {
            await this.extendObjectAsync(entry.id, {
                type: 'state',
                common: {
                    name: entry.id,
                    type: entry.type,
                    role: entry.role,
                    read: true,
                    write: false,
                    unit: entry.unit
                },
                native: {}
            });
            await this.setState(entry.id, { val: entry.val, ack: true });
        }
    }

    flatten(prefix, value, entries) {
        if (value === null || value === undefined) return;

        if (Array.isArray(value)) {
            entries.push({ id: prefix, type: 'string', role: 'json', val: JSON.stringify(value) });
            return;
        }

        const t = typeof value;
        if (t === 'string') {
            entries.push({ id: prefix, type: 'string', role: 'text', val: value });
            return;
        }
        if (t === 'number') {
            entries.push({ id: prefix, type: 'number', role: 'value', val: value });
            return;
        }
        if (t === 'boolean') {
            entries.push({ id: prefix, type: 'boolean', role: 'indicator', val: value });
            return;
        }

        if (t === 'object') {
            const keys = Object.keys(value);
            const valueOnlyObject = keys.every(k => ['value', 'timestamp', 'unit', 'status', 'errorCode', 'message', 'href', 'unavailableReason'].includes(k));
            if (valueOnlyObject && 'value' in value && typeof value.value !== 'object') {
                const role = typeof value.value === 'number' ? 'value' : typeof value.value === 'boolean' ? 'indicator' : 'text';
                const type = typeof value.value === 'number' ? 'number' : typeof value.value === 'boolean' ? 'boolean' : 'string';
                entries.push({ id: prefix, type, role, val: value.value, unit: typeof value.unit === 'string' ? value.unit : undefined });
                for (const metaKey of ['timestamp', 'status', 'errorCode', 'message', 'unit', 'unavailableReason', 'href']) {
                    if (metaKey in value) {
                        const child = value[metaKey];
                        const childType = typeof child === 'number' ? 'number' : typeof child === 'boolean' ? 'boolean' : 'string';
                        const childRole = typeof child === 'number' ? 'value' : typeof child === 'boolean' ? 'indicator' : 'text';
                        entries.push({ id: `${prefix}.${metaKey}`, type: childType, role: childRole, val: child });
                    }
                }
                return;
            }

            for (const [key, child] of Object.entries(value)) {
                const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, '_');
                this.flatten(prefix ? `${prefix}.${safeKey}` : safeKey, child, entries);
            }
        }
    }
}

if (require.main !== module) {
    module.exports = options => new VolvoCvApiPro(options);
} else {
    new VolvoCvApiPro();
}
