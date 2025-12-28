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
        // Use ID-based fallback with number extraction
        const number = contactId.split('@')[0];
        return {
            id: { _serialized: contactId },
            pushname: number,
            name: number,
            number: number,
            isMyContact: false,
            sendMessage: async (content) => {
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
        // Use message data directly as fallback
        const senderId = message.author || message.from;
        const number = senderId.split('@')[0];
        return {
            id: { _serialized: senderId },
            pushname: message._data?.notifyName || number,
            name: message._data?.notifyName || number,
            number: number,
            isMyContact: false
        };
    }
}
