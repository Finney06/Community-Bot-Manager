/**
 * Admin Context Manager
 * Handles DM-based context system for multi-group admin configuration
 */

import {
    getAdminContext,
    setAdminContext,
    clearAdminContext,
    getGroupsByAdmin,
    getGroup
} from '../storage/storage.js';
import { logger } from '../utils/logger.js';

/**
 * Handle 'setup' command - show group selection
 */
export async function handleSetupCommand(message, client) {
    try {
        const adminId = message.from;

        // Get contact safely
        let contact;
        try {
            contact = await message.getContact();
        } catch (error) {
            logger.warn('Could not get contact in setup, using fallback');
            contact = {
                pushname: 'Admin',
                number: adminId
            };
        }

        logger.info(`Setup command from ${contact.pushname || adminId}`);

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

        // Create numbered list of groups
        const groupList = groups
            .map((group, index) => `${index + 1}. ${group.name}`)
            .join('\n');

        const setupMessage = `⚙️ *Group Configuration Setup*

You manage ${groups.length} group${groups.length > 1 ? 's' : ''} with me:

${groupList}

*To configure a group:*
Reply with the number of the group you want to configure.

Example: Send \`1\` to configure the first group.

_Your selection will remain active until you change it or send \`setup\` again._`;

        await message.reply(setupMessage);

        // Store that user is in setup mode (temporary state)
        // We'll handle their next message as a group selection

    } catch (error) {
        logger.error('Error in setup command:', error);
        await message.reply('❌ An error occurred. Please try again.');
    }
}

/**
 * Handle group selection (when user sends a number)
 */
export async function handleGroupSelection(message, client) {
    try {
        const adminId = message.from;
        const selection = parseInt(message.body.trim());

        if (isNaN(selection)) {
            return false; // Not a valid selection
        }

        // Get admin's groups
        const groups = getGroupsByAdmin(adminId);

        if (groups.length === 0) {
            return false;
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

*Available Commands:*
• \`stats\` - View group statistics
• \`settings\` - View current settings
• \`add_banned_word <word>\` - Add banned word
• \`remove_banned_word <word>\` - Remove banned word
• \`list_banned_words\` - Show banned words
• \`toggle_links\` - Enable/disable link blocking
• \`toggle_welcome\` - Enable/disable welcome messages
• \`set_threshold <number>\` - Set warning threshold
• \`view_rules\` - View group rules
• \`add_rule <rule>\` - Add a rule
• \`remove_rule <number>\` - Remove a rule
• \`help\` - Show all commands
• \`setup\` - Change to a different group

Type \`help\` for detailed command information.`;

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
    const noContextMessage = `⚠️ *No Group Selected*

You haven't selected a group to configure yet.

Send \`setup\` to see your groups and select one.`;

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
