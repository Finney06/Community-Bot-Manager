/**
 * Warning System
 * Manages per-user, per-group warning tracking with 3-strike system
 */

import {
    getWarnings,
    addWarning as storageAddWarning,
    clearWarnings as storageClearWarnings,
    logWarning,
    getGroup
} from '../storage/storage.js';
import { logger } from '../utils/logger.js';
import { safeGetContactById } from '../utils/contactUtils.js';

/**
 * Add a warning to a user
 * Returns warning details including whether action threshold is reached
 */
export async function addWarning(groupId, userId, reason, client) {
    try {
        // Add warning to storage
        const result = storageAddWarning(groupId, userId, reason);

        if (!result.success) {
            logger.error('Failed to save warning to storage');
            return { success: false };
        }

        // Log the warning
        logWarning(groupId, userId, reason, result.count);

        // Get group config for threshold
        const group = getGroup(groupId);
        const threshold = group?.config?.moderation?.maxWarningsBeforeAction || 3;

        // Check if threshold reached
        const thresholdReached = result.count >= threshold;

        // Send DM warning to user
        await sendWarningDM(userId, reason, result.count, threshold, groupId, client);

        // Notify admins if threshold reached
        if (thresholdReached) {
            await notifyAdminsThresholdReached(groupId, userId, result.count, client);
        }

        logger.info(`Warning added to user ${userId} in group ${groupId}. Count: ${result.count}/${threshold}`);

        return {
            success: true,
            count: result.count,
            threshold,
            thresholdReached,
            history: result.history
        };
    } catch (error) {
        logger.error('Error adding warning:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get warning count for a user in a group
 */
export function getUserWarnings(groupId, userId) {
    return getWarnings(groupId, userId);
}

/**
 * Clear warnings for a user
 */
export function clearUserWarnings(groupId, userId) {
    const success = storageClearWarnings(groupId, userId);

    if (success) {
        logger.info(`Cleared warnings for user ${userId} in group ${groupId}`);
    }

    return success;
}

/**
 * Check if user should receive action (reached threshold)
 */
export function shouldTakeAction(groupId, userId) {
    const warnings = getWarnings(groupId, userId);
    const group = getGroup(groupId);
    const threshold = group?.config?.moderation?.maxWarningsBeforeAction || 3;

    return warnings.count >= threshold;
}

/**
 * Send warning DM to user
 */
async function sendWarningDM(userId, reason, strikeCount, threshold, groupId, client) {
    try {
        const contact = await safeGetContactById(client, userId);
        const group = getGroup(groupId);
        const groupName = group?.name || 'the group';

        // Get group rules
        const rules = group?.config?.rules || [];
        const rulesText = rules.length > 0
            ? '\n\n📋 *Group Rules:*\n' + rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')
            : '';

        const warningMessage = `⚠️ *Warning from ${groupName}*

Hi ${contact.pushname || contact.name || 'there'},

You've received a warning from the group moderators.

*Reason:* ${reason}
*Strike Count:* ${strikeCount}/${threshold}

${strikeCount >= threshold
                ? '🚨 *You have reached the warning threshold.* Group admins have been notified and may take action.'
                : `You have ${threshold - strikeCount} warning(s) remaining before action is taken.`
            }${rulesText}

Please help us maintain a positive environment for everyone. Thank you! 🙏`;

        await contact.sendMessage(warningMessage);
        logger.info(`Warning DM sent to ${contact.pushname || userId}`);

        return true;
    } catch (error) {
        logger.error('Error sending warning DM:', error);
        return false;
    }
}

/**
 * Send short group notice about violation (optional, configurable)
 */
export async function sendGroupNotice(chat, userId, reason) {
    try {
        const group = getGroup(chat.id._serialized);

        // Check if group notices are enabled
        if (!group?.config?.moderation?.groupNoticesEnabled) {
            return false;
        }

        const contact = await safeGetContactById(chat.client, userId);

        const noticeMessage = `⚠️ @${contact.number} - ${reason}`;

        await chat.sendMessage(noticeMessage, {
            mentions: [contact]
        });

        return true;
    } catch (error) {
        logger.error('Error sending group notice:', error);
        return false;
    }
}

/**
 * Notify admins when user reaches warning threshold
 */
async function notifyAdminsThresholdReached(groupId, userId, strikeCount, client) {
    try {
        const group = getGroup(groupId);

        if (!group || !group.admins) {
            logger.warn('Cannot notify admins - group or admin list not found');
            return false;
        }

        const contact = await safeGetContactById(client, userId);
        const warnings = getWarnings(groupId, userId);

        // Create violation history
        const historyText = warnings.history
            .slice(-5) // Last 5 warnings
            .map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.timestamp).toLocaleString()})`)
            .join('\n');

        const adminMessage = `🚨 *Warning Threshold Reached*

*Group:* ${group.name}
*User:* ${contact.pushname || contact.name || contact.number}
*Total Warnings:* ${strikeCount}

*Recent Violations:*
${historyText}

*Recommended Actions:*
• Review user's recent messages
• Consider muting the user temporarily
• Remove user if violations continue

You can manage this user directly in WhatsApp group settings.`;

        // Send to all admins
        for (const adminId of group.admins) {
            try {
                const adminContact = await safeGetContactById(client, adminId);
                await adminContact.sendMessage(adminMessage);
                logger.info(`Threshold alert sent to admin ${adminContact.pushname || adminId}`);
            } catch (error) {
                logger.error(`Failed to notify admin ${adminId}:`, error);
            }
        }

        return true;
    } catch (error) {
        logger.error('Error notifying admins:', error);
        return false;
    }
}

/**
 * Get warning statistics for a group
 */
export function getGroupWarningStats(groupId) {
    const warnings = getWarnings(groupId);

    const stats = {
        totalUsers: 0,
        totalWarnings: 0,
        usersAtThreshold: 0,
        recentWarnings: []
    };

    const group = getGroup(groupId);
    const threshold = group?.config?.moderation?.maxWarningsBeforeAction || 3;

    for (const [userId, userWarnings] of Object.entries(warnings)) {
        stats.totalUsers++;
        stats.totalWarnings += userWarnings.count;

        if (userWarnings.count >= threshold) {
            stats.usersAtThreshold++;
        }

        // Add recent warnings
        stats.recentWarnings.push(...userWarnings.history.map(h => ({
            userId,
            ...h
        })));
    }

    // Sort recent warnings by timestamp
    stats.recentWarnings.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Keep only last 10
    stats.recentWarnings = stats.recentWarnings.slice(0, 10);

    return stats;
}
