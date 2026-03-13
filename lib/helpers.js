'use strict';

function sanitizeIdPart(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 200) || 'value';
}

function setByPath(target, path, value) {
    let obj = target;
    for (let i = 0; i < path.length - 1; i++) {
        const part = path[i];
        if (!obj[part] || typeof obj[part] !== 'object') obj[part] = {};
        obj = obj[part];
    }
    obj[path[path.length - 1]] = value;
}

function flatten(input, path = [], out = {}) {
    if (input === null || input === undefined) {
        setByPath(out, path, input);
        return out;
    }
    if (Array.isArray(input)) {
        if (!path.length) {
            setByPath(out, ['items'], input);
            return out;
        }
        input.forEach((item, index) => flatten(item, [...path, String(index)], out));
        return out;
    }
    if (typeof input === 'object') {
        const keys = Object.keys(input);
        if (!keys.length && path.length) setByPath(out, path, {});
        for (const [key, value] of Object.entries(input)) {
            flatten(value, [...path, sanitizeIdPart(key)], out);
        }
        return out;
    }
    setByPath(out, path, input);
    return out;
}

function stateDefinitionForValue(value) {
    const isNum = typeof value === 'number' && Number.isFinite(value);
    const isBool = typeof value === 'boolean';
    return {
        type: isNum ? 'number' : isBool ? 'boolean' : 'string',
        role: isNum ? 'value' : isBool ? 'indicator' : 'text',
        value: isNum || isBool ? value : String(value)
    };
}

function extractVin(vehiclePayload) {
    if (!vehiclePayload) return '';
    if (typeof vehiclePayload.vin === 'string') return vehiclePayload.vin;
    if (typeof vehiclePayload.id === 'string' && vehiclePayload.id.length >= 10) return vehiclePayload.id;
    if (Array.isArray(vehiclePayload.vehicles) && vehiclePayload.vehicles.length) {
        const first = vehiclePayload.vehicles[0];
        return extractVin(first);
    }
    if (Array.isArray(vehiclePayload.data) && vehiclePayload.data.length) {
        const first = vehiclePayload.data[0];
        return extractVin(first);
    }
    return '';
}

module.exports = {
    sanitizeIdPart,
    flatten,
    stateDefinitionForValue,
    extractVin
};
