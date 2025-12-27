/**
 * Command Handler
 * Parses commands and routes them to appropriate handlers
 */

import { logger } from '../utils/logger.js';
import { canExecuteAdminCommand } from '../utils/permissions.js';
import * as adminCommands from '../commands/admin.js';
import * as configCommands from '../commands/config.js';

const COMMAND_PREFIX = '!';

/**
 * Check if message is a command
 */
export function isCommand(message) {
    return message.startsWith(COMMAND_PREFIX);
}

/**
 * Parse command from message
 */
export function parseCommand(messageBody) {
    const parts = messageBody.trim().split(/\s+/);
    const command = parts[0].substring(1).toLowerCase(); // Remove ! prefix
    const args = parts.slice(1);

    return { command, args };
}

/**
 * Handle incoming command
 */
export async function handleCommand(message, client) {
    try {
        const { command, args } = parseCommand(message.body);

        logger.info(`Command received: !${command} with args:`, args);

        // Route to appropriate handler
        switch (command) {
            // Admin commands
            case 'warn':
                if (await canExecuteAdminCommand(message, client)) {
                    await adminCommands.handleWarn(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'mute':
                if (await canExecuteAdminCommand(message, client)) {
                    await adminCommands.handleMute(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'status':
                if (await canExecuteAdminCommand(message, client)) {
                    await adminCommands.handleStatus(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            // Configuration commands
            case 'rules':
                if (await canExecuteAdminCommand(message, client)) {
                    await configCommands.handleRules(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'topic':
                if (await canExecuteAdminCommand(message, client)) {
                    await configCommands.handleTopic(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'links':
                if (await canExecuteAdminCommand(message, client)) {
                    await configCommands.handleLinks(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'settings':
                if (await canExecuteAdminCommand(message, client)) {
                    await configCommands.handleSettings(message, args, client);
                } else {
                    await message.reply('⛔ Only group admins can use this command.');
                }
                break;

            case 'help':
                await handleHelp(message);
                break;

            default:
                await message.reply(`❓ Unknown command: !${command}\n\nType !help to see available commands.`);
        }
    } catch (error) {
        logger.error('Error handling command:', error);
        await message.reply('❌ An error occurred while processing your command. Please try again.');
    }
}

/**
 * Handle help command
 */
async function handleHelp(message) {
    const helpText = `📋 *WhatsApp Community Manager - Commands*

*Admin Commands:*
• !warn @user [reason] - Warn a user
• !mute @user [duration] - Mute a user (coming soon)
• !status - Show bot statistics

*Configuration:*
• !rules - Show group rules
• !rules add <rule> - Add a new rule
• !rules remove <number> - Remove a rule
• !topic <topic> - Set group topic
• !links on|off - Enable/disable link blocking
• !settings - Show all settings

*General:*
• !help - Show this help message

_Note: Admin commands require group admin privileges_`;

    await message.reply(helpText);
}
