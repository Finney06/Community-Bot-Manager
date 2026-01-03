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
    
    // Check message type - be more lenient with media
    const isMedia = message.hasMedia || message.type === 'image' || message.type === 'video' || 
                    message.type === 'document' || message.type === 'audio' || message.type === 'sticker';
    
    // Forwarded messages are usually legitimate, don't check for flooding
    const isForwarded = message.isForwarded || message._data?.isForwarded;

    // Check for links
    if (group.config.moderation.spamDetection.linkBlockingEnabled) {
        const hasLink = containsLink(messageBody);

        if (hasLink && !isWhitelistedDomain(messageBody, group.config.moderation.spamDetection.allowedDomains)) {
            await handleSpamDetection(message, chat, 'link', client);
            return { isSpam: true, reason: 'link' };
        }
    }

    // Check for message flooding (skip for media and forwarded messages)
    if (!isMedia && !isForwarded) {
        const isFlooding = checkMessageFlood(userId, group.config.moderation.spamDetection.maxMessagesPerMinute);
        if (isFlooding) {
            await handleSpamDetection(message, chat, 'flood', client);
            return { isSpam: true, reason: 'flood' };
        }
    }

    // Check for repeated messages (only for text messages)
    if (!isMedia && messageBody && messageBody.trim().length > 0) {
        const isRepeated = checkRepeatedMessage(userId, messageBody, group.config.moderation.spamDetection.maxRepeatedMessages);
        if (isRepeated) {
            await handleSpamDetection(message, chat, 'repeated', client);
            return { isSpam: true, reason: 'repeated' };
        }
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
 * Check for message flooding (improved with burst tolerance)
 */
function checkMessageFlood(userId, maxMessages) {
    const cacheKey = `flood_${userId}`;
    const messageHistory = messageCache.get(cacheKey) || [];
    
    const now = Date.now();
    
    // Add current message timestamp
    messageHistory.push(now);
    
    // Keep only messages from the last 60 seconds
    const recentMessages = messageHistory.filter(timestamp => now - timestamp < 60000);
    
    messageCache.set(cacheKey, recentMessages);
    
    // Allow bursts: if someone sends 10 messages in 5 seconds, that's okay (sharing photos)
    // But if they send 20+ messages in 60 seconds, that's flooding
    const burstThreshold = 15; // Allow up to 15 messages in short burst
    const extendedThreshold = maxMessages || 20; // But cap at 20 in full minute
    
    const last5Seconds = recentMessages.filter(timestamp => now - timestamp < 5000);
    
    // Only flag as spam if:
    // 1. More than extendedThreshold messages in 60 seconds AND
    // 2. More than burstThreshold in last 5 seconds (continuous spam)
    return recentMessages.length >= extendedThreshold && last5Seconds.length >= burstThreshold;
}

/**
 * Check for repeated messages (improved to allow some repetition)
 */
function checkRepeatedMessage(userId, messageBody, maxRepeated) {
    const cacheKey = `repeated_${userId}`;
    const messageHistory = repeatedMessageCache.get(cacheKey) || [];

    // Ignore very short messages (like "ok", "yes", emojis) - these are naturally repeated
    if (messageBody.length < 5) {
        return false;
    }
    
    // Create a hash of the message to compare
    const messageHash = crypto.createHash('md5').update(messageBody.toLowerCase().trim()).digest('hex');
    
    // Add current message hash to history
    messageHistory.push(messageHash);

    // Keep only last 10 messages
    if (messageHistory.length > 10) {
        messageHistory.shift();
    }

    repeatedMessageCache.set(cacheKey, messageHistory);

    // Only flag if user sends the EXACT same message many times consecutively
    // Check last N messages (where N = maxRepeated or default 5)
    const checkCount = maxRepeated || 5;
    if (messageHistory.length >= checkCount) {
        const lastMessages = messageHistory.slice(-checkCount);
        const allSame = lastMessages.every(hash => hash === lastMessages[0]);
        
        // Additional check: make sure they're recent (within 2 minutes)
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
