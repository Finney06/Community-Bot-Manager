/**
 * Permission checking utilities for WhatsApp groups
 * Verifies admin status and bot permissions
 */

import { logger } from './logger.js';

/**
 * Check if a user is an admin in the group
 */
export async function isAdmin(chat, userId) {
    try {
        // For private chats, no admin concept
        if (!chat.isGroup) {
            return false;
        }

        const participants = await chat.participants;
        const participant = participants.find(p => p.id._serialized === userId);

        if (!participant) {
            return false;
        }

        return participant.isAdmin || participant.isSuperAdmin;
    } catch (error) {
        logger.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Check if the bot itself is an admin in the group
 */
export async function isBotAdmin(chat, client) {
    try {
        if (!chat.isGroup) {
            return false;
        }

        const botId = client.info.wid._serialized;
        return await isAdmin(chat, botId);
    } catch (error) {
        logger.error('Error checking bot admin status:', error);
        return false;
    }
}

/**
 * Get user's display name
 */
export function getUserName(contact) {
    return contact.pushname || contact.name || contact.number || 'Unknown User';
}

/**
 * Check if user has permission to execute admin commands
 */
export async function canExecuteAdminCommand(message, client) {
    const chat = await message.getChat();

    // In private chats, allow all commands
    if (!chat.isGroup) {
        return true;
    }

    // In groups, only admins can execute admin commands
    return await isAdmin(chat, message.author || message.from);
}
