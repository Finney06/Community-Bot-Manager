/**
 * Message Handler
 * Central processor for all incoming messages
 * Routes DM commands vs group commands appropriately
 */

import { logger } from '../utils/logger.js';
import { isCommand, handleCommand } from './commandHandler.js';
import { checkForSpam } from '../moderation/spamDetector.js';
import { checkRuleViolations } from '../moderation/ruleEnforcer.js';
import {
    handleSetupCommand,
    handleGroupSelection,
    isPotentialGroupSelection
} from './adminContext.js';
import { handleOnboardingMessage } from './onboardingHandler.js';
import { handleEveryoneCommand } from '../commands/everyone.js';
import * as dmCommands from '../commands/dmCommands.js';

/**
 * Main message handler
 */
export async function handleMessage(message, client) {
    try {
        // Ignore messages from the bot itself
        if (message.fromMe) {
            return;
        }

        const chat = await message.getChat();

        // Get contact safely
        let contact;
        try {
            contact = await message.getContact();
        } catch (error) {
            // Use message data directly as fallback
            const senderId = message.author || message.from;
            const senderNumber = senderId.split('@')[0];
            contact = {
                pushname: message._data?.notifyName || 'User',
                number: senderNumber,
                id: { _serialized: senderId }
            };
        }

        // Check if this is a DM (not a group)
        const isDM = !chat.isGroup;

        if (isDM) {
            // Handle DM commands (admin configuration)
            await handleDMMessage(message, client);
            return;
        }

        // Group message handling
        logger.info(`Message from ${contact.pushname || contact.number} in ${chat.name || 'group'}`);

        // Handle commands
        if (isCommand(message.body)) {
            await handleCommand(message, client);
            return;
        }

        // Handle @everyone keyword (not a prefix command)
        if (message.body.toLowerCase().includes('@everyone')) {
            logger.info(`Detected @everyone keyword in ${chat.name}`);
            await handleEveryoneCommand(message, chat, client);
            return;
        }

        // Only apply moderation in groups
        if (chat.isGroup) {
            // Check for spam
            const spamResult = await checkForSpam(message, chat, client);
            if (spamResult.isSpam) {
                logger.warn(`Spam detected from ${contact.pushname || contact.number}`);
                // Spam handler will send warning
                return;
            }

            // Check for rule violations
            const ruleResult = await checkRuleViolations(message, chat);
            if (ruleResult.violation) {
                logger.warn(`Rule violation detected from ${contact.pushname || contact.number}`);
                // Rule enforcer will send warning
                return;
            }
        }

    } catch (error) {
        logger.error('Error handling message:', error);
    }
}

/**
 * Handle DM messages (admin configuration)
 */
async function handleDMMessage(message, client) {
    const messageBody = message.body.trim();

    // Get contact safely
    let contact;
    try {
        contact = await message.getContact();
    } catch (error) {
        // Use message data directly as fallback
        const senderId = message.from;
        const senderNumber = senderId.split('@')[0];
        contact = {
            pushname: message._data?.notifyName || 'User',
            number: senderNumber,
            id: { _serialized: senderId }
        };
    }

    logger.info(`DM from ${contact.pushname || contact.number}: ${messageBody.substring(0, 50)}`);

    // Priority 1: Handle onboarding if session exists
    const onboardingHandled = await handleOnboardingMessage(message, client);
    if (onboardingHandled) {
        return;
    }

    // Handle setup command
    if (messageBody.toLowerCase() === 'setup') {
        await handleSetupCommand(message, client);
        return;
    }

    // Check if this is a group selection (number)
    if (isPotentialGroupSelection(messageBody)) {
        const handled = await handleGroupSelection(message, client);
        if (handled) {
            return;
        }
    }

    // Parse DM commands
    const parts = messageBody.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // List of valid commands
    const validCommands = [
        'stats', 'settings', 'toggle_links', 'toggle_welcome',
        'set_threshold', 'add_banned_word', 'remove_banned_word',
        'list_banned_words', 'view_rules', 'add_rule', 'remove_rule', 'help',
        'restart_onboarding', 'toggle_auto_remove'
    ];

    // Only respond if it's a valid command
    if (!validCommands.includes(command)) {
        // Ignore casual messages - don't respond
        logger.info(`Ignoring non-command DM: ${command}`);
        return;
    }

    // Route to appropriate DM command handler
    switch (command) {
        case 'stats':
            await dmCommands.handleStatsCommand(message, client);
            break;

        case 'settings':
            await dmCommands.handleSettingsCommand(message, client);
            break;

        case 'toggle_links':
            await dmCommands.handleToggleLinksCommand(message, client);
            break;

        case 'toggle_welcome':
            await dmCommands.handleToggleWelcomeCommand(message, client);
            break;

        case 'set_threshold':
            await dmCommands.handleSetThresholdCommand(message, args, client);
            break;

        case 'add_banned_word':
            await dmCommands.handleAddBannedWordCommand(message, args, client);
            break;

        case 'remove_banned_word':
            await dmCommands.handleRemoveBannedWordCommand(message, args, client);
            break;

        case 'list_banned_words':
            await dmCommands.handleListBannedWordsCommand(message, client);
            break;

        case 'view_rules':
            await dmCommands.handleViewRulesCommand(message, client);
            break;

        case 'add_rule':
            await dmCommands.handleAddRuleCommand(message, args, client);
            break;

        case 'remove_rule':
            await dmCommands.handleRemoveRuleCommand(message, args, client);
            break;

        case 'help':
            await dmCommands.handleDMHelpCommand(message, client);
            break;

        case 'restart_onboarding':
            await dmCommands.handleRestartOnboardingCommand(message, client);
            break;

        case 'toggle_auto_remove':
            await dmCommands.handleToggleAutoRemoveCommand(message, client);
            break;
    }
}
