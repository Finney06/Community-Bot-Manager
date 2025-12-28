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
    const authorId = message.author || message.from;
    const group = getGroup(groupId);
    logger.info(`Checking @everyone for group ${groupId} (Sender: ${authorId})`);

    // 1. Check if feature is enabled (Assume true if missing for legacy groups)
    const isEnabled = group?.features?.everyoneEnabled !== false; // Only false if explicitly disabled
    if (!isEnabled) {
        logger.warn(`@everyone is disabled for group: ${group?.name || groupId}`);
        return;
    }

    // 2. Check permissions (Admin only)
    const isUserAdmin = await isAdmin(chat, authorId, client);
    if (!isUserAdmin) {
        logger.warn(`Non-admin attempted @everyone: ${authorId} in ${chat.name}`);
        await message.reply('⛔ Only admins can use @everyone');
        return;
    }
    
    logger.info(`✓ Admin verified: ${authorId}`);

    // 3. Check rate limit
    const now = Date.now();
    const cooldown = group?.features?.everyoneCooldown || 3600000; // Default 1 hour
    const lastUsed = lastUsedCache.get(groupId) || 0;

    if (now - lastUsed < cooldown) {
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
