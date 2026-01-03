/**
 * Group Manager
 * Handles automatic group discovery and registration
 */

import { saveGroup, getGroup, logBotEvent } from '../storage/storage.js';
import { getDefaultConfig } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import { safeGetContactById } from '../utils/contactUtils.js';
import { startOnboarding } from './onboardingHandler.js';

/**
 * Handle when bot is added to a group
 * Automatically registers the group and notifies admins
 */
export async function handleGroupJoin(notification, client) {
    try {
        const chat = await notification.getChat();

        if (!chat.isGroup) {
            return;
        }

        const groupId = chat.id._serialized;
        const groupName = chat.name;

        logger.info(`Bot added to group: ${groupName} (${groupId})`);

        // Check if group already registered
        const existingGroup = getGroup(groupId);
        if (existingGroup) {
            logger.info(`Group ${groupName} already registered`);
            return;
        }

        // Get group admins
        const admins = chat.participants
            .filter(p => p.isAdmin || p.isSuperAdmin)
            .map(p => p.id._serialized);

        logger.info(`Found ${admins.length} admins in ${groupName}`);

        // Create group data with default config
        const groupData = {
            id: groupId,
            name: groupName,
            admins: admins,
            config: getDefaultConfig(groupId, groupName),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            active: true
        };

        // Save to storage
        const success = saveGroup(groupId, groupData);

        if (!success) {
            logger.error(`Failed to register group ${groupName}`);
            return;
        }

        logger.success(`✅ Group registered: ${groupName}`);

        // Log the event
        logBotEvent('group_joined', {
            groupId,
            groupName,
            adminCount: admins.length
        });

        // Send DM to all admins to start onboarding
        await notifyAdmins(admins, groupData, client);

    } catch (error) {
        logger.error('Error handling group join:', error);
    }
}

/**
 * Notify group admins and start onboarding
 */
async function notifyAdmins(adminIds, groupData, client) {
    const welcomeMessage = `👋 *WhatsApp Community Manager Bot*

Hello! I've been added to your group *${groupData.name}* and I'm ready to help you manage your community.

🤖 *What I Do:*
• Detect and warn spam/flooding
• Enforce group rules
• Welcome new members
• Help with moderation

⚙️ *Configuration:*
All settings are managed via DM (Direct Message) with me. To get started:

1. Send me \`setup\` in this chat
2. Select your group from the list
3. Configure settings for that group

*Current Settings:*
✅ Spam detection enabled
✅ Welcome messages enabled
❌ Link blocking disabled (you can enable it)

📋 *Quick Commands:*
• \`setup\` - Select a group to configure
• \`help\` - See all available commands
• \`stats\` - View group statistics

Feel free to reach out if you need help! 🙏

_Note: Make sure I'm a group admin for full moderation features._`;

    for (const adminId of adminIds) {
        try {
            // Trigger the guided onboarding flow
            await startOnboarding(adminId, groupData.id, client);
            logger.info(`Onboarding started for admin: ${adminId}`);
        } catch (error) {
            logger.error(`Failed to start onboarding for admin ${adminId}:`, error);
        }
    }
}

/**
 * Handle when bot is removed from a group
 */
export async function handleGroupLeave(notification, client) {
    try {
        const chat = await notification.getChat();

        if (!chat.isGroup) {
            return;
        }

        const groupId = chat.id._serialized;
        const groupName = chat.name;

        logger.info(`Bot removed from group: ${groupName} (${groupId})`);

        // Log the event (we keep the data for now, don't delete)
        logBotEvent('group_left', {
            groupId,
            groupName
        });

        // Optionally: Mark group as inactive instead of deleting
        const group = getGroup(groupId);
        if (group) {
            group.active = false;
            group.leftAt = new Date().toISOString();
            saveGroup(groupId, group);
        }

    } catch (error) {
        logger.error('Error handling group leave:', error);
    }
}

/**
 * Update group admins list
 * Call this periodically or when admin changes are detected
 */
export async function updateGroupAdmins(groupId, client) {
    try {
        const group = getGroup(groupId);
        if (!group) {
            logger.warn(`Cannot update admins - group ${groupId} not found`);
            return false;
        }

        // Get fresh chat data
        const chat = await client.getChatById(groupId);

        if (!chat.isGroup) {
            return false;
        }

        // Get current admins
        const admins = chat.participants
            .filter(p => p.isAdmin || p.isSuperAdmin)
            .map(p => p.id._serialized);

        // Update group data
        group.admins = admins;
        group.updatedAt = new Date().toISOString();

        const success = saveGroup(groupId, group);

        if (success) {
            logger.info(`Updated admins for group ${group.name}: ${admins.length} admins`);
        }

        return success;
    } catch (error) {
        logger.error('Error updating group admins:', error);
        return false;
    }
}

/**
 * Sync all groups the bot is currently in
 * Useful for initial setup or after bot restart
 */
export async function syncAllGroups(client) {
    try {
        logger.info('Starting comprehensive group sync...');

        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        logger.info(`Found ${groups.length} total groups in WhatsApp account`);

        let newGroups = 0;
        let updatedGroups = 0;
        let skippedGroups = 0;

        for (const chat of groups) {
            try {
                const groupId = chat.id._serialized;
                const existingGroup = getGroup(groupId);

                // Fetch full chat to ensure participants are loaded
                // This is a slow but reliable process for initial sync
                const fullChat = await client.getChatById(groupId);

                // If participants are empty, try to force-load them
                if (!fullChat.participants || fullChat.participants.length === 0) {
                    // Small delay to let the library catch up
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try {
                        // Fetching recent messages often triggers participant loading
                        await fullChat.fetchMessages({ limit: 1 });
                    } catch (e) { }
                }

                const admins = (fullChat.participants || [])
                    .filter(p => p.isAdmin || p.isSuperAdmin)
                    .map(p => p.id._serialized);

                // Only register groups where we can actually see admins
                // (If we can't see admins, we can't verify permissions)
                if (admins.length > 0) {
                    if (!existingGroup) {
                        // New group - register it
                        const groupData = {
                            id: groupId,
                            name: fullChat.name || chat.name,
                            admins: admins,
                            config: getDefaultConfig(groupId, fullChat.name || chat.name),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            active: true
                        };

                        saveGroup(groupId, groupData);
                        newGroups++;
                        logger.info(`Registered: "${fullChat.name || chat.name}" (${admins.length} admins)`);
                    } else {
                        // Existing group - update admins and name
                        existingGroup.name = fullChat.name || chat.name;
                        existingGroup.admins = admins;
                        existingGroup.active = true;
                        existingGroup.updatedAt = new Date().toISOString();

                        saveGroup(groupId, existingGroup);
                        updatedGroups++;
                    }
                } else {
                    skippedGroups++;
                    // We don't log every skip to avoid flooding the console
                }

                // Substantial delay between groups for large accounts to avoid being blocked
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err) {
                logger.error(`Error syncing group ${chat.name}: ${err.message}`);
            }
        }

        logger.success(`✅ Sync complete: ${newGroups} new, ${updatedGroups} updated, ${skippedGroups} skipped (no admins detected)`);

        return {
            total: groups.length,
            newGroups,
            updatedGroups,
            skippedGroups
        };
    } catch (error) {
        logger.error('Fatal error during group sync:', error);
        return null;
    }
}
