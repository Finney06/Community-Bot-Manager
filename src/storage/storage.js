/**
 * Storage Abstraction Layer
 * Handles all data persistence operations with JSON files
 * Designed for easy migration to database in the future
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');
const ADMIN_SESSIONS_FILE = path.join(DATA_DIR, 'admin_sessions.json');
const ONBOARDING_SESSIONS_FILE = path.join(DATA_DIR, 'onboarding_sessions.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.jsonl'); // JSON Lines format

// In-memory caches (exported for handlers to manage temporal session state)
export let groupsCache = {};
export let warningsCache = {};
export let adminSessionsCache = {};
export let onboardingSessionsCache = {};

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Safe file read with error handling
 */
function safeReadJSON(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            return defaultValue;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return defaultValue;
    }
}

/**
 * Safe file write with atomic operation
 */
function safeWriteJSON(filePath, data) {
    try {
        ensureDataDir();
        const tempFile = `${filePath}.tmp`;

        // Write to temp file first
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');

        // Atomic rename
        fs.renameSync(tempFile, filePath);

        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Initialize storage system
 */
export function initStorage() {
    ensureDataDir();

    // Load all data into memory
    groupsCache = safeReadJSON(GROUPS_FILE, {});
    warningsCache = safeReadJSON(WARNINGS_FILE, {});
    adminSessionsCache = safeReadJSON(ADMIN_SESSIONS_FILE, {});
    onboardingSessionsCache = safeReadJSON(ONBOARDING_SESSIONS_FILE, {});

    console.log('✅ Storage system initialized');
}

// ============================================================================
// GROUP OPERATIONS
// ============================================================================

/**
 * Get all groups
 */
export function getAllGroups() {
    return { ...groupsCache };
}

/**
 * Get a specific group by ID
 */
export function getGroup(groupId) {
    return groupsCache[groupId] || null;
}

/**
 * Save or update a group
 */
export function saveGroup(groupId, groupData) {
    groupsCache[groupId] = {
        ...groupData,
        updatedAt: new Date().toISOString()
    };

    return safeWriteJSON(GROUPS_FILE, groupsCache);
}

/**
 * Update specific fields of a group
 */
export function updateGroup(groupId, updates) {
    if (!groupsCache[groupId]) {
        return false;
    }

    groupsCache[groupId] = {
        ...groupsCache[groupId],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    return safeWriteJSON(GROUPS_FILE, groupsCache);
}

/**
 * Delete a group
 */
export function deleteGroup(groupId) {
    if (!groupsCache[groupId]) {
        return false;
    }

    delete groupsCache[groupId];
    return safeWriteJSON(GROUPS_FILE, groupsCache);
}

/**
 * Get all groups where a user is an admin
 */
export function getGroupsByAdmin(adminId) {
    const groups = [];

    for (const [groupId, groupData] of Object.entries(groupsCache)) {
        if (groupData.admins && groupData.admins.includes(adminId)) {
            groups.push({
                id: groupId,
                name: groupData.name,
                ...groupData
            });
        }
    }

    return groups;
}

// ============================================================================
// WARNING OPERATIONS
// ============================================================================

/**
 * Get warnings for a specific user in a specific group
 */
export function getWarnings(groupId, userId) {
    if (!warningsCache[groupId] || !warningsCache[groupId][userId]) {
        return {
            count: 0,
            history: []
        };
    }

    return warningsCache[groupId][userId];
}

/**
 * Add a warning to a user in a group
 */
export function addWarning(groupId, userId, reason) {
    // Initialize group warnings if needed
    if (!warningsCache[groupId]) {
        warningsCache[groupId] = {};
    }

    // Initialize user warnings if needed
    if (!warningsCache[groupId][userId]) {
        warningsCache[groupId][userId] = {
            count: 0,
            history: []
        };
    }

    // Add warning
    warningsCache[groupId][userId].count++;
    warningsCache[groupId][userId].history.push({
        reason,
        timestamp: new Date().toISOString()
    });

    const success = safeWriteJSON(WARNINGS_FILE, warningsCache);

    return {
        success,
        count: warningsCache[groupId][userId].count,
        history: warningsCache[groupId][userId].history
    };
}

/**
 * Clear warnings for a user in a group
 */
export function clearWarnings(groupId, userId) {
    if (!warningsCache[groupId] || !warningsCache[groupId][userId]) {
        return false;
    }

    delete warningsCache[groupId][userId];
    return safeWriteJSON(WARNINGS_FILE, warningsCache);
}

/**
 * Get all warnings for a group
 */
export function getGroupWarnings(groupId) {
    return warningsCache[groupId] || {};
}

// ============================================================================
// ADMIN SESSION OPERATIONS
// ============================================================================

/**
 * Get admin's active group context
 */
export function getAdminContext(adminId) {
    return adminSessionsCache[adminId] || null;
}

/**
 * Set admin's active group context
 */
export function setAdminContext(adminId, groupId) {
    adminSessionsCache[adminId] = {
        activeGroupId: groupId,
        lastUpdated: new Date().toISOString()
    };

    return safeWriteJSON(ADMIN_SESSIONS_FILE, adminSessionsCache);
}

/**
 * Clear admin's context
 */
export function clearAdminContext(adminId) {
    if (!adminSessionsCache[adminId]) {
        return false;
    }

    delete adminSessionsCache[adminId];
    return safeWriteJSON(ADMIN_SESSIONS_FILE, adminSessionsCache);
}

/**
 * Get all admin sessions
 */
export function getAllAdminSessions() {
    return { ...adminSessionsCache };
}

// ============================================================================
// ONBOARDING SESSION OPERATIONS
// ============================================================================

/**
 * Get onboarding session for an admin
 */
export function getOnboardingSession(adminId) {
    return onboardingSessionsCache[adminId] || null;
}

/**
 * Set onboarding session for an admin
 */
export function setOnboardingSession(adminId, sessionData) {
    onboardingSessionsCache[adminId] = {
        ...sessionData,
        lastUpdated: new Date().toISOString()
    };

    return safeWriteJSON(ONBOARDING_SESSIONS_FILE, onboardingSessionsCache);
}

/**
 * Clear onboarding session for an admin
 */
export function clearOnboardingSession(adminId) {
    if (!onboardingSessionsCache[adminId]) {
        return false;
    }

    delete onboardingSessionsCache[adminId];
    return safeWriteJSON(ONBOARDING_SESSIONS_FILE, onboardingSessionsCache);
}
// ============================================================================
// LOGGING OPERATIONS
// ============================================================================

/**
 * Append a log entry (JSON Lines format)
 */
export function appendLog(logEntry) {
    try {
        ensureDataDir();

        const logLine = JSON.stringify({
            ...logEntry,
            timestamp: new Date().toISOString()
        }) + '\n';

        fs.appendFileSync(LOGS_FILE, logLine, 'utf8');
        return true;
    } catch (error) {
        console.error('Error appending log:', error.message);
        return false;
    }
}

/**
 * Read recent logs (last N entries)
 */
export function getRecentLogs(count = 100) {
    try {
        if (!fs.existsSync(LOGS_FILE)) {
            return [];
        }

        const data = fs.readFileSync(LOGS_FILE, 'utf8');
        const lines = data.trim().split('\n').filter(line => line.length > 0);

        // Get last N lines
        const recentLines = lines.slice(-count);

        return recentLines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(entry => entry !== null);
    } catch (error) {
        console.error('Error reading logs:', error.message);
        return [];
    }
}

/**
 * Get logs for a specific group
 */
export function getGroupLogs(groupId, count = 50) {
    const allLogs = getRecentLogs(1000); // Read more to filter
    return allLogs
        .filter(log => log.groupId === groupId)
        .slice(-count);
}

/**
 * Log types for structured logging
 */
export const LogTypes = {
    WARNING: 'warning',
    MESSAGE_DELETED: 'message_deleted',
    ADMIN_COMMAND: 'admin_command',
    EVERYONE_USAGE: 'everyone_usage',
    BOT_EVENT: 'bot_event',
    ERROR: 'error'
};

/**
 * Helper to log a warning
 */
export function logWarning(groupId, userId, reason, strikeCount) {
    return appendLog({
        type: LogTypes.WARNING,
        groupId,
        userId,
        reason,
        strikeCount
    });
}

/**
 * Helper to log a deleted message
 */
export function logDeletedMessage(groupId, userId, reason, messageHash) {
    return appendLog({
        type: LogTypes.MESSAGE_DELETED,
        groupId,
        userId,
        reason,
        messageHash
    });
}

/**
 * Helper to log an admin command
 */
export function logAdminCommand(groupId, adminId, command, args) {
    return appendLog({
        type: LogTypes.ADMIN_COMMAND,
        groupId,
        adminId,
        command,
        args
    });
}

/**
 * Helper to log @everyone usage
 */
export function logEveryoneUsage(groupId, adminId) {
    return appendLog({
        type: LogTypes.EVERYONE_USAGE,
        groupId,
        adminId
    });
}

/**
 * Helper to log bot events
 */
export function logBotEvent(eventType, details) {
    return appendLog({
        type: LogTypes.BOT_EVENT,
        eventType,
        details
    });
}

/**
 * Helper to log errors
 */
export function logError(error, context = {}) {
    return appendLog({
        type: LogTypes.ERROR,
        error: {
            message: error.message,
            stack: error.stack
        },
        context
    });
}
