/**
 * Configuration Manager
 * Handles loading, saving, and updating group configurations
 * Internal layer - users never interact with this directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDefaultConfig } from './defaults.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// In-memory cache of configurations
let configCache = {};

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        logger.info('Created config directory');
    }
}

/**
 * Load all configurations from file
 */
function loadConfigFromFile() {
    try {
        ensureConfigDir();

        if (!fs.existsSync(CONFIG_FILE)) {
            logger.info('No config file found, starting with empty config');
            return {};
        }

        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error('Error loading config file:', error);
        return {};
    }
}

/**
 * Save all configurations to file
 */
function saveConfigToFile() {
    try {
        ensureConfigDir();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(configCache, null, 2), 'utf8');
        logger.info('Configuration saved to file');
    } catch (error) {
        logger.error('Error saving config file:', error);
    }
}

/**
 * Initialize config manager
 */
export function initConfigManager() {
    configCache = loadConfigFromFile();
    logger.success('Config manager initialized');
}

/**
 * Get configuration for a specific group
 */
export function getGroupConfig(groupId, groupName = null) {
    // If config doesn't exist for this group, create default
    if (!configCache[groupId]) {
        logger.info(`Creating default config for group: ${groupName || groupId}`);
        configCache[groupId] = getDefaultConfig(groupId, groupName);
        saveConfigToFile();
    }

    return configCache[groupId];
}

/**
 * Update a specific configuration value for a group
 */
export function updateGroupConfig(groupId, updates) {
    try {
        // Ensure config exists
        if (!configCache[groupId]) {
            logger.warn(`Config not found for group ${groupId}, creating default`);
            configCache[groupId] = getDefaultConfig(groupId);
        }

        // Deep merge updates
        configCache[groupId] = deepMerge(configCache[groupId], updates);
        configCache[groupId].updatedAt = new Date().toISOString();

        saveConfigToFile();
        logger.success(`Config updated for group ${groupId}`);
        return true;
    } catch (error) {
        logger.error('Error updating config:', error);
        return false;
    }
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }

    return output;
}

/**
 * Add a rule to a group's rules list
 */
export function addRule(groupId, rule) {
    const config = getGroupConfig(groupId);

    if (!config.rules.includes(rule)) {
        config.rules.push(rule);
        updateGroupConfig(groupId, { rules: config.rules });
        return true;
    }

    return false; // Rule already exists
}

/**
 * Remove a rule from a group's rules list
 */
export function removeRule(groupId, ruleIndex) {
    const config = getGroupConfig(groupId);

    if (ruleIndex >= 0 && ruleIndex < config.rules.length) {
        config.rules.splice(ruleIndex, 1);
        updateGroupConfig(groupId, { rules: config.rules });
        return true;
    }

    return false; // Invalid index
}

/**
 * Get all rules for a group
 */
export function getRules(groupId) {
    const config = getGroupConfig(groupId);
    return config.rules;
}
