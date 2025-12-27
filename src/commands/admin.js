/**
 * Admin Commands
 * Commands for group moderation and management
 */

import { logger } from '../utils/logger.js';
import { getGroupConfig } from '../config/configManager.js';
import { getUserName } from '../utils/permissions.js';
import { safeGetContactById } from '../utils/contactUtils.js';

/**
 * Handle !warn command
 */
export async function handleWarn(message, args, client) {
    try {
        const chat = await message.getChat();

        // Check if user mentioned someone
        if (!message.mentionedIds || message.mentionedIds.length === 0) {
            await message.reply('⚠️ Please mention a user to warn.\n\nUsage: !warn @user [reason]');
            return;
        }

        const mentionedId = message.mentionedIds[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        // Get mentioned user's contact
        const mentionedContact = await safeGetContactById(client, mentionedId);
        const userName = getUserName(mentionedContact);

        // Send gentle warning
        const warningMessage = `⚠️ *Friendly Reminder*

Hi @${mentionedContact.number}, this is a gentle reminder from the group admins.

*Reason:* ${reason}

Please help us maintain a positive environment for everyone. Thank you! 🙏`;

        await chat.sendMessage(warningMessage, {
            mentions: [mentionedContact]
        });

        logger.info(`Warning sent to ${userName} for: ${reason}`);
    } catch (error) {
        logger.error('Error in warn command:', error);
        await message.reply('❌ Failed to send warning. Please try again.');
    }
}

/**
 * Handle !mute command (placeholder for MVP)
 */
export async function handleMute(message, args, client) {
    await message.reply('🚧 Mute functionality is coming soon!\n\nFor now, please use WhatsApp\'s built-in group settings to remove members if needed.');
}

/**
 * Handle !status command
 */
export async function handleStatus(message, args, client) {
    try {
        const chat = await message.getChat();

        if (!chat.isGroup) {
            await message.reply('ℹ️ This command only works in groups.');
            return;
        }

        const config = getGroupConfig(chat.id._serialized, chat.name);
        const participants = chat.participants.length;
        const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).length;

        const statusMessage = `📊 *Group Status*

*Group:* ${chat.name}
*Members:* ${participants}
*Admins:* ${admins}

*Bot Settings:*
• Spam Detection: ${config.moderation.spamDetection.enabled ? '✅' : '❌'}
• Link Blocking: ${config.moderation.spamDetection.linkBlockingEnabled ? '✅' : '❌'}
• Auto-Delete: ${config.moderation.autoDeleteEnabled ? '✅' : '❌'}
• Welcome Messages: ${config.welcome.enabled ? '✅' : '❌'}
• Group Topic: ${config.moderation.offTopicDetection.groupTopic || 'Not set'}

Type !settings for detailed configuration.`;

        await message.reply(statusMessage);
    } catch (error) {
        logger.error('Error in status command:', error);
        await message.reply('❌ Failed to retrieve status. Please try again.');
    }
}
