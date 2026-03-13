'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const {
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
} = require('./lib/endpoints');
const { flatten, stateDefinitionForValue, extractVin } = require('./lib/helpers');

class VolvoCvApiAdapter extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'volvocvapi_xc60' });
        this.client = axios.create({ timeout: 30000, validateStatus: () => true });
        this.pollTimer = null;
        this.pollCount = 0;
        this.tokenCache = { accessToken: '', refreshToken: '', expiresAt: 0 };
        this.vehicleVin = '';
        this.availableCommands = {};

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    debug(msg) {
        if (this.config.enableDebug) this.log.debug(msg);
    }

    async onReady() {
        try {
            await this.ensureObjectTree();
            await this.loadTokenCache();
            await this.ensureToken();
            await this.resolveVin();
            await this.pollOnce();

            const pollMs = Math.max(60, Number(this.config.pollIntervalSec) || 300) * 1000;
            this.pollTimer = this.setInterval(() => {
                this.pollOnce().catch(error => this.handleError(`Polling failed: ${error.message}`));
            }, pollMs);
        } catch (error) {
            await this.handleError(`Startup failed: ${error.message}`);
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

    async ensureObjectTree() {
        const channels = ['info', 'commands', 'commandsLastResult', 'availableCommands', 'connected', 'energy', 'location', 'raw'];
        for (const ch of channels) {
            await this.extendObjectAsync(ch, { type: 'channel', common: { name: ch }, native: {} });
        }
        const infoDefs = {
            'info.connection': { type: 'boolean', role: 'indicator.connected', def: false },
            'info.lastUpdate': { type: 'string', role: 'text' },
            'info.lastError': { type: 'string', role: 'text' },
            'info.selectedVin': { type: 'string', role: 'text' },
            'info.tokenExpiresAt': { type: 'string', role: 'text' },
            'info.authSource': { type: 'string', role: 'text' },
            'info.commandAccessibility': { type: 'string', role: 'text' },
            'info.supportedCommands': { type: 'string', role: 'json' }
        };
        for (const [id, common] of Object.entries(infoDefs)) {
            await this.extendObjectAsync(id, {
                type: 'state',
                common: { name: id, read: true, write: false, ...common },
                native: {}
            });
        }

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
        }

        await this.setStateAsync('info.connection', false, true);
        await this.subscribeStatesAsync('commands.*');
    }

    async loadTokenCache() {
        this.tokenCache.accessToken = (this.config.accessToken || '').trim();
        this.tokenCache.refreshToken = (this.config.refreshToken || '').trim();
        await this.setStateAsync('info.authSource', this.tokenCache.refreshToken ? 'refreshToken' : this.tokenCache.accessToken ? 'accessToken' : 'none', true);
    }

    getAuthHeaders() {
        return {
            authorization: `Bearer ${this.tokenCache.accessToken}`,
            'vcc-api-key': this.config.apiKey,
            accept: 'application/json'
        };
    }

    getBasicAuthHeader() {
        if (!this.config.clientId || !this.config.clientSecret) {
            throw new Error('clientId/clientSecret missing');
        }
        const encoded = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        return `Basic ${encoded}`;
    }

    async ensureToken() {
        if (!this.config.apiKey) throw new Error('VCC API key missing');
        const now = Date.now();
        if (this.tokenCache.accessToken && this.tokenCache.expiresAt && (this.tokenCache.expiresAt - now > 120000)) return;
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
        const body = new URLSearchParams({ grant_type: 'authorization_code', code: this.config.authCode, redirect_uri: redirectUri });
        if (this.config.codeVerifier) body.set('code_verifier', this.config.codeVerifier);
        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: this.getBasicAuthHeader() },
            timeout: 30000
        });
        this.applyTokenResponse(response.data, 'authorization_code');
    }

    async refreshToken() {
        const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.tokenCache.refreshToken });
        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: this.getBasicAuthHeader() },
            timeout: 30000
        });
        this.applyTokenResponse(response.data, 'refresh_token');
    }

    async applyTokenResponse(data, source) {
        if (!data || !data.access_token) throw new Error(`Token request failed during ${source}`);
        this.tokenCache.accessToken = data.access_token;
        if (data.refresh_token) this.tokenCache.refreshToken = data.refresh_token;
        const expiresInSec = Number(data.expires_in || 3600);
        this.tokenCache.expiresAt = Date.now() + Math.max(60, expiresInSec - 60) * 1000;
        await this.setStateAsync('info.tokenExpiresAt', new Date(this.tokenCache.expiresAt).toISOString(), true);
        await this.setStateAsync('info.authSource', source, true);
    }

    async resolveVin() {
        if (this.config.vin) {
            this.vehicleVin = this.config.vin.trim();
        } else {
            const data = await this.getJson(CONNECTED_BASE, '/vehicles');
            const vin = extractVin(data);
            if (!vin) throw new Error('Could not auto-detect VIN from /vehicles');
            this.vehicleVin = vin;
        }
        await this.setStateAsync('info.selectedVin', this.vehicleVin, true);
    }

    async onStateChange(id, state) {
        if (!state || state.ack) return;
        const commandName = id.split('.').pop();
        if (!COMMANDS[commandName]) return;
        try {
            await this.ensureToken();
            if (!this.vehicleVin) await this.resolveVin();
            const result = await this.invokeCommand(commandName);
            await this.setStateAsync(`commandsLastResult.${commandName}`, JSON.stringify(result), true);
            await this.setStateAsync(id, false, true);
        } catch (error) {
            await this.setStateAsync(`commandsLastResult.${commandName}`, JSON.stringify({ error: error.message }), true);
            await this.setStateAsync(id, false, true);
            await this.handleError(`Command ${commandName} failed: ${error.message}`);
        }
    }

    async invokeCommand(commandName) {
        const def = COMMANDS[commandName];
        const path = def.path.replace('{vin}', this.vehicleVin);
        let body = def.body || {};
        if (def.bodyConfig) {
            body = { runtime: Number(this.config[def.bodyConfig]) || 10 };
        }
        const response = await this.client.post(`${CONNECTED_BASE}${path}`, body, {
            headers: { ...this.getAuthHeaders(), 'content-type': 'application/json' }
        });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        this.debug(`Command ${commandName} ok: ${JSON.stringify(response.data)}`);
        return response.data;
    }

    async pollOnce() {
        await this.ensureToken();
        if (!this.vehicleVin) await this.resolveVin();

        this.pollCount += 1;
        const slowCycle = Math.max(1, Number(this.config.slowCycleCount) || 12);
        const doSlow = this.pollCount === 1 || this.pollCount % slowCycle === 0;

        const jobs = [];
        jobs.push(...CONNECTED_FAST_ENDPOINTS.map(path => this.fetchAndStore('connected', CONNECTED_BASE, path)));
        if (doSlow) jobs.push(...CONNECTED_SLOW_ENDPOINTS.map(path => this.fetchAndStore('connected', CONNECTED_BASE, path)));

        if (this.config.enableEnergy) {
            jobs.push(...ENERGY_FAST_ENDPOINTS.map(path => this.fetchAndStore('energy', ENERGY_BASE, path)));
            if (doSlow) jobs.push(...ENERGY_SLOW_ENDPOINTS.map(path => this.fetchAndStore('energy', ENERGY_BASE, path)));
        }
        if (this.config.enableLocation) {
            jobs.push(...LOCATION_FAST_ENDPOINTS.map(path => this.fetchAndStore('location', LOCATION_BASE, path)));
        }

        const results = await Promise.allSettled(jobs);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || String(r.reason));
        await this.setStateAsync('info.lastUpdate', new Date().toISOString(), true);
        await this.setStateAsync('info.connection', errors.length === 0, true);
        await this.setStateAsync('info.lastError', errors[0] || '', true);
    }

    async fetchAndStore(root, baseUrl, rawPath) {
        const path = rawPath.replace('{vin}', this.vehicleVin);
        const data = await this.getJson(baseUrl, path);
        if (rawPath.endsWith('/commands')) {
            await this.updateAvailableCommands(data);
        }
        if (rawPath.endsWith('/command-accessibility')) {
            await this.setStateAsync('info.commandAccessibility', JSON.stringify(data), true);
        }
        await this.storeFlattened(`${root}${path.replace(`/vehicles/${this.vehicleVin}`, '.vehicle').replace(/\//g, '.')}`, data);
        if (this.config.includeRawJson) {
            const rawId = `${root}${path.replace(`/vehicles/${this.vehicleVin}`, '.vehicle').replace(/\//g, '.')}`
                .replace(/^\./, '')
                .replace(/\.+/g, '.');
            await this.storeRaw(`raw.${rawId}`, data);
        }
    }

    async getJson(baseUrl, path) {
        const url = `${baseUrl}${path}`;
        const response = await this.client.get(url, { headers: this.getAuthHeaders() });
        if (response.status === 401 && this.tokenCache.refreshToken) {
            this.debug(`401 for ${url}, refreshing token once`);
            await this.refreshToken();
            const retry = await this.client.get(url, { headers: this.getAuthHeaders() });
            if (retry.status >= 400) throw new Error(`HTTP ${retry.status} for ${path}: ${JSON.stringify(retry.data)}`);
            return retry.data;
        }
        if (response.status >= 400) throw new Error(`HTTP ${response.status} for ${path}: ${JSON.stringify(response.data)}`);
        return response.data;
    }

    async updateAvailableCommands(data) {
        const json = JSON.stringify(data);
        await this.setStateAsync('info.supportedCommands', json, true);
        const text = json.toUpperCase();
        for (const [name, def] of Object.entries(COMMANDS)) {
            const available = text.includes(def.command);
            this.availableCommands[name] = available;
            await this.setStateAsync(`availableCommands.${name}`, available, true);
        }
    }

    async storeRaw(id, data) {
        await this.extendObjectAsync(id, {
            type: 'state',
            common: { name: id, type: 'string', role: 'json', read: true, write: false },
            native: {}
        });
        await this.setStateAsync(id, JSON.stringify(data), true);
    }

    async storeFlattened(rootId, payload) {
        const flat = flatten(payload);
        const entries = this.walkFlat(flat, []);
        for (const entry of entries) {
            const id = `${rootId}.${entry.path.join('.')}`.replace(/^\./, '').replace(/\.+/g, '.');
            const def = stateDefinitionForValue(entry.value);
            await this.extendObjectAsync(id, {
                type: 'state',
                common: {
                    name: id,
                    type: def.type,
                    role: def.role,
                    read: true,
                    write: false
                },
                native: {}
            });
            await this.setStateAsync(id, def.value, true);
        }
    }

    walkFlat(obj, path) {
        const results = [];
        if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
            results.push({ path, value: obj });
            return results;
        }
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                results.push(...this.walkFlat(value, [...path, key]));
            } else {
                results.push({ path: [...path, key], value });
            }
        }
        return results;
    }

    async handleError(message) {
        this.log.error(message);
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastError', message, true);
    }
}

if (require.main !== module) {
    module.exports = options => new VolvoCvApiAdapter(options);
} else {
    new VolvoCvApiAdapter();
}
