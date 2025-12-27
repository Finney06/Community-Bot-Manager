/**
 * Rule Enforcer
 * Checks messages for rule violations and off-topic content
 */

import { logger } from '../utils/logger.js';
import { getGroupConfig } from '../config/configManager.js';
import { getUserName } from '../utils/permissions.js';

/**
 * Check message for rule violations
 */
export async function checkRuleViolations(message, chat) {
    const config = getGroupConfig(chat.id._serialized, chat.name);
    const messageBody = message.body.toLowerCase();

    // Check for banned words
    if (config.moderation.bannedWords.enabled) {
        const hasBannedWord = config.moderation.bannedWords.words.some(word =>
            messageBody.includes(word.toLowerCase())
        );

        if (hasBannedWord) {
            await handleRuleViolation(message, chat, 'banned_word');
            return { violation: true, reason: 'banned_word' };
        }
    }

    // Check for off-topic content
    if (config.moderation.offTopicDetection.enabled && config.moderation.offTopicDetection.groupTopic) {
        const isOffTopic = checkOffTopic(messageBody, config.moderation.offTopicDetection);

        if (isOffTopic) {
            await handleRuleViolation(message, chat, 'off_topic');
            return { violation: true, reason: 'off_topic' };
        }
    }

    return { violation: false };
}

/**
 * Check if message is off-topic
 * Simple keyword-based detection for MVP
 */
function checkOffTopic(messageBody, offTopicConfig) {
    // If no keywords are configured, we can't determine off-topic
    if (!offTopicConfig.keywords || offTopicConfig.keywords.length === 0) {
        return false;
    }

    // Check if message contains any topic-related keywords
    const hasTopicKeyword = offTopicConfig.keywords.some(keyword =>
        messageBody.includes(keyword.toLowerCase())
    );

    // If message is long enough and doesn't contain topic keywords, it might be off-topic
    // Only flag if message is substantial (more than 20 characters)
    if (messageBody.length > 20 && !hasTopicKeyword) {
        return true;
    }

    return false;
}

/**
 * Handle rule violation - send gentle warning
 */
async function handleRuleViolation(message, chat, reason) {
    try {
        const contact = await message.getContact();
        const userName = getUserName(contact);
        const config = getGroupConfig(chat.id._serialized, chat.name);

        let warningMessage = '';

        switch (reason) {
            case 'banned_word':
                warningMessage = `⚠️ Hi @${contact.number},

Your message contains content that's not allowed in this group. Please review our group rules.

Let's keep the conversation respectful! 🙏`;
                break;

            case 'off_topic':
                const topic = config.moderation.offTopicDetection.groupTopic;
                warningMessage = `📌 Hi @${contact.number},

This group is focused on *${topic}*. Your message seems to be off-topic.

Please help us keep discussions relevant. Thank you! 🙏`;
                break;
        }

        await chat.sendMessage(warningMessage, {
            mentions: [contact]
        });

        logger.info(`Rule violation warning sent to ${userName} for: ${reason}`);

        // If auto-delete is enabled, delete the message
        if (config.moderation.autoDeleteEnabled) {
            try {
                await message.delete(true); // Delete for everyone
                logger.info(`Deleted message from ${userName} due to rule violation`);
            } catch (error) {
                logger.warn('Could not delete message (bot may not be admin):', error.message);
            }
        }
    } catch (error) {
        logger.error('Error handling rule violation:', error);
    }
}
