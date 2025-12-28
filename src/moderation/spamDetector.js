/**
 * Spam Detector
 * Detects and handles spam, links, and flood messages
 */

import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import { getGroup, logDeletedMessage } from '../storage/storage.js';
import { getUserName } from '../utils/permissions.js';
import { addWarning, sendGroupNotice } from './warningSystem.js';
import crypto from 'crypto';

// Cache for tracking user message history
// TTL of 60 seconds - messages older than this are automatically removed
const messageCache = new NodeCache({ stdTTL: 60, checkperiod: 10 });

// Cache for tracking repeated messages
const repeatedMessageCache = new NodeCache({ stdTTL: 300, checkperiod: 30 });

/**
 * Check if message contains spam
 */
export async function checkForSpam(message, chat, client) {
    const groupId = chat.id._serialized;
    const group = getGroup(groupId);

    if (!group || !group.config.moderation.spamDetection.enabled) {
        return { isSpam: false };
    }

    const userId = message.author || message.from;
    const messageBody = message.body;

    // Check for links
    if (group.config.moderation.spamDetection.linkBlockingEnabled) {
        const hasLink = containsLink(messageBody);

        if (hasLink && !isWhitelistedDomain(messageBody, group.config.moderation.spamDetection.allowedDomains)) {
            await handleSpamDetection(message, chat, 'link', client);
            return { isSpam: true, reason: 'link' };
        }
    }

    // Check for message flooding
    const isFlooding = checkMessageFlood(userId, group.config.moderation.spamDetection.maxMessagesPerMinute);
    if (isFlooding) {
        await handleSpamDetection(message, chat, 'flood', client);
        return { isSpam: true, reason: 'flood' };
    }

    // Check for repeated messages
    const isRepeated = checkRepeatedMessage(userId, messageBody, group.config.moderation.spamDetection.maxRepeatedMessages);
    if (isRepeated) {
        await handleSpamDetection(message, chat, 'repeated', client);
        return { isSpam: true, reason: 'repeated' };
    }

    return { isSpam: false };
}

/**
 * Check if message contains a link
 */
function containsLink(text) {
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|co|app|dev|xyz|me|info|biz)[^\s]*)/gi;
    return urlPattern.test(text);
}

/**
 * Check if link is from a whitelisted domain
 */
function isWhitelistedDomain(text, allowedDomains) {
    if (allowedDomains.length === 0) {
        return false;
    }

    return allowedDomains.some(domain => text.toLowerCase().includes(domain.toLowerCase()));
}

/**
 * Check for message flooding
 */
function checkMessageFlood(userId, maxMessages) {
    const cacheKey = `flood_${userId}`;
    const messageCount = messageCache.get(cacheKey) || 0;

    messageCache.set(cacheKey, messageCount + 1);

    return messageCount >= maxMessages;
}

/**
 * Check for repeated messages
 */
function checkRepeatedMessage(userId, messageBody, maxRepeated) {
    const cacheKey = `repeated_${userId}`;
    const messageHistory = repeatedMessageCache.get(cacheKey) || [];

    // Add current message to history
    messageHistory.push(messageBody);

    // Keep only recent messages
    if (messageHistory.length > maxRepeated) {
        messageHistory.shift();
    }

    repeatedMessageCache.set(cacheKey, messageHistory);

    // Check if all recent messages are the same
    if (messageHistory.length >= maxRepeated) {
        const allSame = messageHistory.every(msg => msg === messageHistory[0]);
        return allSame;
    }

    return false;
}

/**
 * Handle spam detection - delete message, add warning, notify
 */
async function handleSpamDetection(message, chat, reason, client) {
    try {
        // Get contact safely with fallback
        let contact;
        try {
            contact = await message.getContact();
        } catch (error) {
            logger.warn(`Could not resolve contact for ${message.author || message.from}: ${error.message}`);
            // Use fallback contact info
            contact = {
                pushname: 'User',
                number: (message.author || message.from).split('@')[0],
                id: { _serialized: message.author || message.from }
            };
        }
        const userName = getUserName(contact);
        const userId = message.author || message.from;
        const groupId = chat.id._serialized;

        // Try to delete the message if bot is admin
        let deleted = false;
        try {
            const group = getGroup(groupId);
            const botNumber = client.info.wid._serialized;
            const botParticipant = chat.participants.find(p => p.id._serialized === botNumber);

            if (botParticipant && (botParticipant.isAdmin || botParticipant.isSuperAdmin)) {
                await message.delete(true); // Delete for everyone
                deleted = true;

                // Log deleted message
                const messageHash = crypto.createHash('md5').update(message.body).digest('hex');
                logDeletedMessage(groupId, userId, reason, messageHash);

                logger.info(`Deleted spam message from ${userName}`);
            }
        } catch (error) {
            logger.warn(`Could not delete message: ${error.message}`);
        }

        // Add warning to user
        const reasonText = {
            'link': 'Posting unauthorized links',
            'flood': 'Message flooding',
            'repeated': 'Repeated messages'
        }[reason] || reason;

        await addWarning(groupId, userId, reasonText, client);

        // Send optional group notice (if enabled)
        await sendGroupNotice(chat, userId, reasonText);

        logger.info(`Spam handled for ${userName}: ${reason} (deleted: ${deleted})`);
    } catch (error) {
        logger.error('Error handling spam detection:', error);
    }
}
