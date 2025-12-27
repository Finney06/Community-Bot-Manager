/**
 * Configuration Commands
 * Simple, human-friendly commands for bot configuration
 */

import { logger } from '../utils/logger.js';
import { getGroupConfig, updateGroupConfig, addRule, removeRule, getRules } from '../config/configManager.js';

/**
 * Handle !rules command
 */
export async function handleRules(message, args, client) {
    try {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;

        // No arguments - show rules
        if (args.length === 0) {
            const rules = getRules(groupId);

            if (rules.length === 0) {
                await message.reply('📋 No rules have been set for this group.\n\nUse !rules add <rule> to add a rule.');
                return;
            }

            let rulesText = '📋 *Group Rules*\n\n';
            rules.forEach((rule, index) => {
                rulesText += `${index + 1}. ${rule}\n`;
            });

            await message.reply(rulesText);
            return;
        }

        // Handle subcommands
        const subcommand = args[0].toLowerCase();

        if (subcommand === 'add') {
            const rule = args.slice(1).join(' ');

            if (!rule) {
                await message.reply('⚠️ Please provide a rule to add.\n\nUsage: !rules add <rule>');
                return;
            }

            const added = addRule(groupId, rule);

            if (added) {
                await message.reply(`✅ Rule added successfully!\n\n"${rule}"`);
            } else {
                await message.reply('ℹ️ This rule already exists.');
            }
        } else if (subcommand === 'remove') {
            const ruleNumber = parseInt(args[1]);

            if (isNaN(ruleNumber)) {
                await message.reply('⚠️ Please provide a valid rule number.\n\nUsage: !rules remove <number>');
                return;
            }

            const removed = removeRule(groupId, ruleNumber - 1); // Convert to 0-indexed

            if (removed) {
                await message.reply(`✅ Rule #${ruleNumber} removed successfully!`);
            } else {
                await message.reply(`❌ Invalid rule number. Use !rules to see all rules.`);
            }
        } else {
            await message.reply('❓ Unknown subcommand.\n\nUsage:\n• !rules - Show all rules\n• !rules add <rule> - Add a rule\n• !rules remove <number> - Remove a rule');
        }
    } catch (error) {
        logger.error('Error in rules command:', error);
        await message.reply('❌ Failed to process rules command. Please try again.');
    }
}

/**
 * Handle !topic command
 */
export async function handleTopic(message, args, client) {
    try {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;

        if (args.length === 0) {
            const config = getGroupConfig(groupId);
            const currentTopic = config.moderation.offTopicDetection.groupTopic;

            if (currentTopic) {
                await message.reply(`📌 Current group topic: *${currentTopic}*\n\nUse !topic <new topic> to change it.`);
            } else {
                await message.reply('📌 No topic set.\n\nUse !topic <topic> to set a group topic for off-topic detection.');
            }
            return;
        }

        const topic = args.join(' ');

        updateGroupConfig(groupId, {
            moderation: {
                offTopicDetection: {
                    enabled: true,
                    groupTopic: topic
                }
            }
        });

        await message.reply(`✅ Group topic set to: *${topic}*\n\nOff-topic detection is now enabled.`);
    } catch (error) {
        logger.error('Error in topic command:', error);
        await message.reply('❌ Failed to set topic. Please try again.');
    }
}

/**
 * Handle !links command
 */
export async function handleLinks(message, args, client) {
    try {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;

        if (args.length === 0) {
            const config = getGroupConfig(groupId);
            const status = config.moderation.spamDetection.linkBlockingEnabled ? 'enabled' : 'disabled';

            await message.reply(`🔗 Link blocking is currently *${status}*.\n\nUse !links on or !links off to change.`);
            return;
        }

        const action = args[0].toLowerCase();

        if (action === 'on') {
            updateGroupConfig(groupId, {
                moderation: {
                    spamDetection: {
                        linkBlockingEnabled: true
                    }
                }
            });
            await message.reply('✅ Link blocking enabled! Links will now trigger warnings.');
        } else if (action === 'off') {
            updateGroupConfig(groupId, {
                moderation: {
                    spamDetection: {
                        linkBlockingEnabled: false
                    }
                }
            });
            await message.reply('✅ Link blocking disabled. Links are now allowed.');
        } else {
            await message.reply('❓ Invalid option.\n\nUsage: !links on or !links off');
        }
    } catch (error) {
        logger.error('Error in links command:', error);
        await message.reply('❌ Failed to update link settings. Please try again.');
    }
}

/**
 * Handle !settings command
 */
export async function handleSettings(message, args, client) {
    try {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;
        const config = getGroupConfig(groupId);

        const settingsText = `⚙️ *Bot Settings for ${chat.name}*

*Moderation:*
• Warnings: ${config.moderation.warningsEnabled ? '✅ Enabled' : '❌ Disabled'}
• Auto-Delete: ${config.moderation.autoDeleteEnabled ? '✅ Enabled' : '❌ Disabled'}
• Max Warnings: ${config.moderation.maxWarningsBeforeAction}

*Spam Detection:*
• Enabled: ${config.moderation.spamDetection.enabled ? '✅' : '❌'}
• Link Blocking: ${config.moderation.spamDetection.linkBlockingEnabled ? '✅' : '❌'}
• Max Messages/Min: ${config.moderation.spamDetection.maxMessagesPerMinute}

*Off-Topic Detection:*
• Enabled: ${config.moderation.offTopicDetection.enabled ? '✅' : '❌'}
• Topic: ${config.moderation.offTopicDetection.groupTopic || 'Not set'}

*Welcome Messages:*
• Enabled: ${config.welcome.enabled ? '✅' : '❌'}

*Rules:* ${config.rules.length} rule(s) configured

Use specific commands to modify settings:
• !rules - Manage group rules
• !topic - Set group topic
• !links - Toggle link blocking`;

        await message.reply(settingsText);
    } catch (error) {
        logger.error('Error in settings command:', error);
        await message.reply('❌ Failed to retrieve settings. Please try again.');
    }
}
