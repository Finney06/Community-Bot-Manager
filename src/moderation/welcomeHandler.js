/**
 * Welcome Handler
 * Handles new member join events and sends welcome messages
 */

import { logger } from '../utils/logger.js';
import { getGroupConfig } from '../config/configManager.js';

/**
 * Handle new member joining the group
 */
export async function handleNewMember(notification) {
    try {
        const chat = await notification.getChat();
        const config = getGroupConfig(chat.id._serialized, chat.name);

        // Check if welcome messages are enabled
        if (!config.welcome.enabled) {
            return;
        }

        // Get the new member(s)
        const newMembers = notification.recipientIds || [];

        if (newMembers.length === 0) {
            return;
        }

        // Send welcome message
        const welcomeMessage = config.welcome.message;

        // Add a small delay to appear more natural
        await new Promise(resolve => setTimeout(resolve, config.rateLimits.botMessageDelay));

        await chat.sendMessage(welcomeMessage);

        logger.info(`Welcome message sent to ${newMembers.length} new member(s) in ${chat.name}`);
    } catch (error) {
        logger.error('Error sending welcome message:', error);
    }
}
