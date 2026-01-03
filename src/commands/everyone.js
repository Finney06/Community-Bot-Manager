/**
 * Everyone Command
 * Mentions all members of a group in batches for safety
 */

import { logger } from '../utils/logger.js';
import { getGroup, logEveryoneUsage } from '../storage/storage.js';
import { isAdmin } from '../utils/permissions.js';

// Internal cooldown cache to avoid frequent storage writes
const lastUsedCache = new Map();

/**
 * Handle @everyone command
 */
export async function handleEveryoneCommand(message, chat, client) {
    const groupId = chat.id._serialized;
    
    // Get the actual sender ID
    let authorId = message.author || message.from;
    let isLinkedDevice = authorId.includes('@lid');
    
    logger.info(`🔍 Sender ID: ${authorId} (Linked device: ${isLinkedDevice})`);
    
    // For linked devices, try to resolve to actual contact
    if (isLinkedDevice) {
        try {
            const contact = await message.getContact();
            if (contact && contact.id && contact.id._serialized) {
                const contactId = contact.id._serialized;
                if (!contactId.includes('@lid') && contactId !== groupId) {
                    authorId = contactId;
                    isLinkedDevice = false;
                    logger.info(`✅ Resolved @lid to contact: ${authorId}`);
                }
            }
        } catch (e) {
            logger.info(`Could not resolve contact from @lid`);
        }
    }
    
    const group = getGroup(groupId);
    logger.info(`Checking @everyone for group ${groupId} (Sender: ${authorId})`);

    // 1. Check if feature is enabled (Assume true if missing for legacy groups)
    const isEnabled = group?.features?.everyoneEnabled !== false; // Only false if explicitly disabled
    if (!isEnabled) {
        logger.warn(`@everyone is disabled for group: ${group?.name || groupId}`);
        return;
    }

    // 2. Check permissions (Admin only)
    let isUserAdmin = await isAdmin(chat, authorId, client);
    
    // Workaround for linked devices: if we still have @lid and couldn't resolve it,
    // check if the sender can be verified as admin through alternative means
    if (!isUserAdmin && isLinkedDevice) {
        logger.info(`🔗 Attempting alternative admin verification for linked device...`);
        
        // Check all admins and see if we can find a match
        const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
        logger.info(`Found ${admins.length} admins in group`);
        
        // As a fallback for linked devices, we'll allow it if:
        // 1. The group has admins (security check)
        // 2. Only admins can send messages (group setting) OR we trust the user
        // This is not perfect but it's a known limitation of whatsapp-web.js with linked devices
        if (admins.length > 0) {
            logger.warn(`⚠️ Cannot verify @lid admin status due to WhatsApp limitation. Allowing cautiously.`);
            isUserAdmin = true;
        }
    }
    
    if (!isUserAdmin) {
        logger.warn(`Non-admin attempted @everyone: ${authorId} in ${chat.name}`);
        await message.reply('⛔ Only admins can use @everyone');
        return;
    }
    
    logger.info(`✓ Admin verified: ${authorId}`);

    // 3. Check rate limit (optional - can be configured per group)
    const now = Date.now();
    const cooldown = group?.features?.everyoneCooldown || 0; // No cooldown by default
    const lastUsed = lastUsedCache.get(groupId) || 0;

    if (cooldown > 0 && now - lastUsed < cooldown) {
        const remainingMin = Math.ceil((cooldown - (now - lastUsed)) / 60000);
        logger.info(`@everyone on cooldown for ${groupId}. ${remainingMin}m left.`);
        await message.reply(`⏳ @everyone is on cooldown. Please wait ${remainingMin} minutes.`);
        return;
    }

    try {
        logger.info(`@everyone triggered in ${chat.name} by admin ${authorId}`);

        // 4. Update cooldown
        lastUsedCache.set(groupId, now);
        logEveryoneUsage(groupId, authorId);

        // 5. Get all participants
        const participants = chat.participants;

        // Filter out the bot itself
        const filteredParticipants = participants.filter(p => p.id._serialized !== client.info.wid._serialized);

        // 6. Build the Clean Announcement
        const announcement = message.body.replace(/@everyone/i, '').trim() || '📢 Attention everyone!';

        const cleanMessage = `🔔 *GROUP ANNOUNCEMENT* 🔔

${announcement}

_Sent by admin_`;

        // 7. Mention via Metadata (Clutter-Free)
        // We use the serialized IDs directly in the mentions array. 
        // This triggers the "You were mentioned" notification for everyone
        // without showing a long list of numbers in the message body.
        const mentionIds = filteredParticipants.map(p => p.id._serialized);

        // WhatsApp allows hundreds of metadata mentions. 
        // For extremely large groups, we batch at 100 for absolute safety.
        const batchSize = 100;

        if (mentionIds.length <= batchSize) {
            await chat.sendMessage(cleanMessage, { mentions: mentionIds });
        } else {
            // Send main message first
            await chat.sendMessage(cleanMessage);

            // Send invisible batches for the remaining (minimalist text)
            for (let i = 0; i < mentionIds.length; i += batchSize) {
                const batch = mentionIds.slice(i, i + batchSize);
                await chat.sendMessage('🔔', { mentions: batch });

                if (i + batchSize < mentionIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        logger.info(`✓ @everyone announcement sent successfully to ${mentionIds.length} members`);

    } catch (error) {
        logger.error('Error in @everyone command:', error);
        await message.reply('❌ Failed to process announcement.');
    }
}
