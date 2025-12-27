/**
 * WhatsApp Community Manager Bot
 * Main entry point
 */

import { createClient, initializeClient } from './client.js';
import { handleMessage } from './handlers/messageHandler.js';
import { handleGroupJoin, handleGroupLeave, syncAllGroups } from './handlers/groupManager.js';
import { initStorage } from './storage/storage.js';
import { logger } from './utils/logger.js';

/**
 * Main function to start the bot
 */
async function main() {
    try {
        logger.info('🤖 Starting WhatsApp Community Manager Bot...');
        logger.info('');

        // Initialize storage system
        initStorage();

        // Create and initialize WhatsApp client
        const client = createClient();

        // Set up message handler
        client.on('message', async (message) => {
            await handleMessage(message, client);
        });

        // Set up group join handler
        client.on('group_join', async (notification) => {
            await handleGroupJoin(notification, client);
        });

        // Set up group leave handler
        client.on('group_leave', async (notification) => {
            await handleGroupLeave(notification, client);
        });

        // Initialize the client (this will show QR code if needed)
        await initializeClient();

        // After client is ready, sync all groups
        client.on('ready', async () => {
            logger.info('');
            logger.info('Syncing groups...');
            await syncAllGroups(client);
            logger.info('');
            logger.success('✅ Bot is fully operational!');
        });

    } catch (error) {
        logger.error('Fatal error starting bot:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('');
    logger.info('Shutting down bot gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('');
    logger.info('Shutting down bot gracefully...');
    process.exit(0);
});

// Start the bot
main();

