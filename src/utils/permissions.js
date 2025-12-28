/**
 * Permission checking utilities for WhatsApp groups
 * Verifies admin status and bot permissions
 */

import { logger } from './logger.js';
import { safeGetContactById } from './contactUtils.js';

/**
 * Check if a user is an admin in the group
 */
export async function isAdmin(chat, userId, client = null) {
    try {
        if (!chat.isGroup) {
            return false;
        }

        let freshChat = chat;
        // If client is provided, get fresh chat data to ensure admin list is current
        if (client) {
            try {
                freshChat = await client.getChatById(chat.id._serialized);
            } catch (e) {
                logger.warn(`Could not fetch fresh chat for admin check: ${e.message}`);
            }
        }

        const participants = freshChat.participants;
        if (!participants) {
            logger.warn(`No participants found in chat: ${freshChat.name || freshChat.id._serialized}`);
            return false;
        }

        // 1. Direct match on serialized ID (The most common case)
        const directMatch = participants.find(p => p.id._serialized === userId);
        if (directMatch) {
            return directMatch.isAdmin || directMatch.isSuperAdmin;
        }

        // 2. Resolve Contact to find Primary ID (Crucial for @lid users)
        // If we have a client, we can find the "true" ID associated with this sender
        if (client) {
            try {
                const contact = await safeGetContactById(client, userId);
                const primaryId = contact.id._serialized;

                if (primaryId && primaryId !== userId) {
                    logger.info(`🔄 Resolving ${userId} -> Primary ID: ${primaryId}`);
                    const primaryMatch = participants.find(p => p.id._serialized === primaryId);
                    if (primaryMatch) {
                        return primaryMatch.isAdmin || primaryMatch.isSuperAdmin;
                    }
                }
            } catch (e) {
                logger.debug(`Could not resolve contact for ${userId}, trying fallback: ${e.message}`);
            }
        }

        // 3. Fallback: Loose numeric match (Last resort)
        // Extract numeric part from userId (before @)
        const targetNumber = userId.split('@')[0];
        
        logger.info(`🔍 Looking for admin with number: ${targetNumber} from ID: ${userId}`);
        logger.info(`📋 Group has ${participants.length} participants`);
        
        for (const p of participants) {
            // Log all participants for debugging
            const participantNumber = p.id._serialized.split('@')[0];
            const pIdUser = p.id.user || 'N/A';
            logger.info(`  - Participant: ${p.id._serialized} | user: ${pIdUser} | admin: ${p.isAdmin || p.isSuperAdmin}`);
            
            if (p.isAdmin || p.isSuperAdmin) {
                // Try multiple comparison methods
                if (participantNumber === targetNumber) {
                    logger.info(`✅ Admin matched via _serialized split: ${userId} matches ${p.id._serialized}`);
                    return true;
                }
                
                if (p.id.user === targetNumber) {
                    logger.info(`✅ Admin matched via id.user: ${userId} matches ${p.id._serialized}`);
                    return true;
                }
            }
        }

        logger.warn(`❌ User ${userId} (number: ${targetNumber}) not found as admin in group.`);
        return false;
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
        return await isAdmin(chat, botId, client);
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
    const authorId = message.author || message.from;
    return await isAdmin(chat, authorId, client);
}
