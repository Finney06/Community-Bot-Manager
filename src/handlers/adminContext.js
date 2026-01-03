/**
 * Admin Context Manager
 * Handles DM-based context system for multi-group admin configuration
 */

import {
    getAdminContext,
    setAdminContext,
    clearAdminContext,
    getGroupsByAdmin,
    getGroup,
    getOnboardingSession,
    adminSessionsCache
} from '../storage/storage.js';
import { logger } from '../utils/logger.js';
import { startOnboarding } from './onboardingHandler.js';

/**
 * Handle 'setup' command - show group selection with pagination
 */
export async function handleSetupCommand(message, client, page = 1) {
    try {
        const adminId = message.from;
        const GROUPS_PER_PAGE = 10;

        // Get contact safely
        let contact;
        try {
            contact = await message.getContact();
        } catch (error) {
            // Using fallback contact info when getContact() fails (e.g., linked devices)
            contact = {
                pushname: 'Admin',
                number: adminId
            };
        }

        logger.info(`Setup command from ${contact.pushname || adminId} (Page ${page})`);

        // Get all groups where this user is an admin
        const groups = getGroupsByAdmin(adminId);

        if (groups.length === 0) {
            await message.reply(`❌ *No Groups Found*

You are not an admin in any groups where I'm active.

To use me:
1. Add me to a WhatsApp group
2. Make me an admin in that group
3. Make sure you're also an admin
4. Come back and send \`setup\` again`);
            return;
        }

        // If user is an admin but has never finished onboarding for ANY group, 
        // OR if they specifically have an active onboarding session, use that.
        // For now, let's keep it simple: if they only have one group and no session, 
        // trigger onboarding for that group.
        if (groups.length === 1 && page === 1) {
            await startOnboarding(adminId, groups[0].id, client);
            return;
        }

        // Pagination logic
        const totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
        const startIdx = (page - 1) * GROUPS_PER_PAGE;
        const endIdx = Math.min(startIdx + GROUPS_PER_PAGE, groups.length);
        const pageGroups = groups.slice(startIdx, endIdx);

        // Create numbered list of groups
        const groupList = pageGroups
            .map((group, index) => `${startIdx + index + 1}. ${group.name}`)
            .join('\n');

        let paginationNotice = ``;
        if (totalPages > 1) {
            paginationNotice = `\n\n📄 *Page ${page} of ${totalPages}*
Type \`next\` or \`prev\` to see more groups.`;
        }

        const setupMessage = `⚙️ *Group Configuration Setup*

You manage ${groups.length} group${groups.length > 1 ? 's' : ''} with me. 
Select which group you want to configure:

${groupList}${paginationNotice}

*To configure a group:*
Reply with the number of the group.

Example: Send \`1\` to configure the first group.

_Your selection will remain active until you change it or send \`setup\` again._`;

        await message.reply(setupMessage);

        // Store page state in admin context
        const currentContext = getAdminContext(adminId) || {};
        setAdminContext(adminId, currentContext.activeGroupId || null);
        // We'll use the cache to store temporal page state for the setup list
        adminSessionsCache[adminId].setupPage = page;

    } catch (error) {
        logger.error('Error in setup command:', error);
        await message.reply('❌ An error occurred. Please try again.');
    }
}

/**
 * Handle group selection (when user sends a number or next/prev)
 */
export async function handleGroupSelection(message, client) {
    try {
        const adminId = message.from;
        const body = message.body.trim().toLowerCase();

        // Get admin's groups
        const groups = getGroupsByAdmin(adminId);
        if (groups.length === 0) return false;

        // Handle pagination commands
        const context = getAdminContext(adminId) || {};
        const currentPage = context.setupPage || 1;
        const totalPages = Math.ceil(groups.length / 10);

        if (body === 'next') {
            if (currentPage < totalPages) {
                await handleSetupCommand(message, client, currentPage + 1);
            } else {
                await message.reply('You are already on the last page.');
            }
            return true;
        }

        if (body === 'prev' || body === 'previous') {
            if (currentPage > 1) {
                await handleSetupCommand(message, client, currentPage - 1);
            } else {
                await message.reply('You are already on the first page.');
            }
            return true;
        }

        const selection = parseInt(body);
        if (isNaN(selection)) {
            return false; // Not a valid selection
        }

        // Check if selection is valid
        if (selection < 1 || selection > groups.length) {
            await message.reply(`❌ Invalid selection. Please choose a number between 1 and ${groups.length}.

Send \`setup\` to see the group list again.`);
            return true;
        }

        // Get selected group
        const selectedGroup = groups[selection - 1];

        // Set admin context
        const success = setAdminContext(adminId, selectedGroup.id);

        if (!success) {
            await message.reply('❌ Failed to set context. Please try again.');
            return true;
        }

        logger.success(`Admin ${adminId} selected group: ${selectedGroup.name}`);

        // Confirm selection
        const confirmMessage = `✅ *Group Selected*

You are now configuring: *${selectedGroup.name}*

All commands you send will apply to this group until you change it.

*Common Tasks:*
• \`settings\` - View current settings
• \`stats\` - View group statistics
• \`view_rules\` - View group rules
• \`help\` - Show all commands
• \`setup\` - Switch to another group

_Type any command above to get started._`;

        await message.reply(confirmMessage);

        return true;
    } catch (error) {
        logger.error('Error handling group selection:', error);
        return false;
    }
}

/**
 * Get the active group for an admin
 * Returns null if no context is set
 */
export function getActiveGroup(adminId) {
    const context = getAdminContext(adminId);

    if (!context || !context.activeGroupId) {
        return null;
    }

    return getGroup(context.activeGroupId);
}

/**
 * Check if admin has an active context
 */
export function hasActiveContext(adminId) {
    const context = getAdminContext(adminId);
    return context !== null && context.activeGroupId !== null;
}

/**
 * Clear admin's context
 */
export function clearContext(adminId) {
    return clearAdminContext(adminId);
}

/**
 * Prompt admin to select a group if no context is set
 */
export async function promptGroupSelection(message) {
    const noContextMessage = `👋 *Welcome to Community Bot!*

It looks like you haven't selected a group to configure yet. I support multi-group management, so you just need to tell me which group you want to manage.

Send \`setup\` to see a list of your groups and get started!

_Once you select a group, I'll guide you through the setup._`;

    await message.reply(noContextMessage);
}

/**
 * Check if message is a potential group selection
 * (single digit or number)
 */
export function isPotentialGroupSelection(messageBody) {
    const trimmed = messageBody.trim();
    const number = parseInt(trimmed);

    // Check if it's a simple number (1-99)
    return !isNaN(number) && number > 0 && number < 100 && trimmed === number.toString();
}

/**
 * Get context info for display
 */
export function getContextInfo(adminId) {
    const group = getActiveGroup(adminId);

    if (!group) {
        return {
            hasContext: false,
            message: 'No group selected'
        };
    }

    return {
        hasContext: true,
        groupId: group.id,
        groupName: group.name,
        message: `Active group: ${group.name}`
    };
}
