/**
 * Contact Utilities
 * Safe wrappers for getting contact information
 */

import { logger } from './logger.js';

/**
 * Safely get contact by ID with fallback
 */
export async function safeGetContactById(client, contactId) {
    try {
        const contact = await client.getContactById(contactId);
        return contact;
    } catch (error) {
        logger.warn(`Could not get contact ${contactId}, using fallback`);
        return {
            id: { _serialized: contactId },
            pushname: 'User',
            name: 'User',
            number: contactId.split('@')[0],
            isMyContact: false,
            sendMessage: async (content) => {
                // Fallback: try to send via client
                try {
                    await client.sendMessage(contactId, content);
                } catch (err) {
                    logger.error(`Failed to send message to ${contactId}:`, err);
                }
            }
        };
    }
}

/**
 * Safely get contact from message
 */
export async function safeGetContact(message) {
    try {
        const contact = await message.getContact();
        return contact;
    } catch (error) {
        logger.warn('Could not get contact from message, using fallback');
        return {
            id: { _serialized: message.from },
            pushname: 'User',
            name: 'User',
            number: message.from ? message.from.split('@')[0] : 'unknown',
            isMyContact: false
        };
    }
}
