/**
 * DM Commands
 * All admin configuration commands (DM-only)
 */

import {
    getActiveGroup,
    hasActiveContext,
    promptGroupSelection
} from '../handlers/adminContext.js';
import { updateGroup, logAdminCommand } from '../storage/storage.js';
import { logger } from '../utils/logger.js';
import { getGroupWarningStats } from '../moderation/warningSystem.js';

/**
 * Handle stats command - show group statistics
 */
export async function handleStatsCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);

    try {
        // Get warning stats
        const warningStats = getGroupWarningStats(group.id);

        // Get group chat for member count
        const chat = await client.getChatById(group.id);
        const memberCount = chat.participants.length;
        const adminCount = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).length;

        const statsMessage = `📊 *Group Statistics*

*Group:* ${group.name}
*Members:* ${memberCount}
*Admins:* ${adminCount}

*Moderation Stats:*
• Total warnings issued: ${warningStats.totalWarnings}
• Users with warnings: ${warningStats.totalUsers}
• Users at threshold: ${warningStats.usersAtThreshold}

*Bot Settings:*
• Spam Detection: ${group.config.moderation.spamDetection.enabled ? '✅' : '❌'}
• Link Blocking: ${group.config.moderation.spamDetection.linkBlockingEnabled ? '✅' : '❌'}
• Welcome Messages: ${group.config.welcome.enabled ? '✅' : '❌'}
• Warning Threshold: ${group.config.moderation.maxWarningsBeforeAction}

Send \`settings\` for detailed configuration.`;

        await message.reply(statsMessage);
        logAdminCommand(group.id, adminId, 'stats', []);

    } catch (error) {
        logger.error('Error in stats command:', error);
        await message.reply('❌ Failed to retrieve statistics.');
    }
}

/**
 * Handle settings command - show all settings
 */
export async function handleSettingsCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);
    const config = group.config;

    const settingsMessage = `⚙️ *Group Settings*

*Group:* ${group.name}

*Moderation:*
• Spam Detection: ${config.moderation.spamDetection.enabled ? '✅' : '❌'}
• Link Blocking: ${config.moderation.spamDetection.linkBlockingEnabled ? '✅' : '❌'}
• Max Messages/Min: ${config.moderation.spamDetection.maxMessagesPerMinute}
• Max Repeated: ${config.moderation.spamDetection.maxRepeatedMessages}
• Warning Threshold: ${config.moderation.maxWarningsBeforeAction}

*Welcome System:*
• Enabled: ${config.welcome.enabled ? '✅' : '❌'}

*Banned Words:*
• Count: ${config.moderation.bannedWords.words.length}
• Enabled: ${config.moderation.bannedWords.enabled ? '✅' : '❌'}

*Group Rules:*
${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

*Commands to modify:*
• \`toggle_links\` - Toggle link blocking
• \`toggle_welcome\` - Toggle welcome messages
• \`set_threshold <number>\` - Set warning threshold
• \`add_banned_word <word>\` - Add banned word
• \`add_rule <rule>\` - Add a rule`;

    await message.reply(settingsMessage);
    logAdminCommand(group.id, adminId, 'settings', []);
}

/**
 * Handle toggle_links command
 */
export async function handleToggleLinksCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);
    const currentState = group.config.moderation.spamDetection.linkBlockingEnabled;
    const newState = !currentState;

    // Update config
    group.config.moderation.spamDetection.linkBlockingEnabled = newState;
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Link blocking ${newState ? 'enabled' : 'disabled'} for *${group.name}*`);
        logAdminCommand(group.id, adminId, 'toggle_links', [newState]);
    } else {
        await message.reply('❌ Failed to update settings.');
    }
}

/**
 * Handle toggle_welcome command
 */
export async function handleToggleWelcomeCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);
    const currentState = group.config.welcome.enabled;
    const newState = !currentState;

    // Update config
    group.config.welcome.enabled = newState;
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Welcome messages ${newState ? 'enabled' : 'disabled'} for *${group.name}*`);
        logAdminCommand(group.id, adminId, 'toggle_welcome', [newState]);
    } else {
        await message.reply('❌ Failed to update settings.');
    }
}

/**
 * Handle set_threshold command
 */
export async function handleSetThresholdCommand(message, args, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const threshold = parseInt(args[0]);

    if (isNaN(threshold) || threshold < 1 || threshold > 10) {
        await message.reply('❌ Invalid threshold. Please provide a number between 1 and 10.\n\nUsage: `set_threshold 3`');
        return;
    }

    const group = getActiveGroup(adminId);

    // Update config
    group.config.moderation.maxWarningsBeforeAction = threshold;
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Warning threshold set to ${threshold} for *${group.name}*`);
        logAdminCommand(group.id, adminId, 'set_threshold', [threshold]);
    } else {
        await message.reply('❌ Failed to update settings.');
    }
}

/**
 * Handle add_banned_word command
 */
export async function handleAddBannedWordCommand(message, args, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    if (args.length === 0) {
        await message.reply('❌ Please provide a word to ban.\n\nUsage: `add_banned_word spam`');
        return;
    }

    const word = args.join(' ').toLowerCase();
    const group = getActiveGroup(adminId);

    // Check if word already exists
    if (group.config.moderation.bannedWords.words.includes(word)) {
        await message.reply(`⚠️ "${word}" is already in the banned words list.`);
        return;
    }

    // Add word
    group.config.moderation.bannedWords.words.push(word);
    group.config.moderation.bannedWords.enabled = true; // Auto-enable
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Added "${word}" to banned words for *${group.name}*\n\nTotal banned words: ${group.config.moderation.bannedWords.words.length}`);
        logAdminCommand(group.id, adminId, 'add_banned_word', [word]);
    } else {
        await message.reply('❌ Failed to add banned word.');
    }
}

/**
 * Handle remove_banned_word command
 */
export async function handleRemoveBannedWordCommand(message, args, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    if (args.length === 0) {
        await message.reply('❌ Please provide a word to remove.\n\nUsage: `remove_banned_word spam`');
        return;
    }

    const word = args.join(' ').toLowerCase();
    const group = getActiveGroup(adminId);

    const index = group.config.moderation.bannedWords.words.indexOf(word);

    if (index === -1) {
        await message.reply(`⚠️ "${word}" is not in the banned words list.`);
        return;
    }

    // Remove word
    group.config.moderation.bannedWords.words.splice(index, 1);
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Removed "${word}" from banned words for *${group.name}*\n\nRemaining banned words: ${group.config.moderation.bannedWords.words.length}`);
        logAdminCommand(group.id, adminId, 'remove_banned_word', [word]);
    } else {
        await message.reply('❌ Failed to remove banned word.');
    }
}

/**
 * Handle list_banned_words command
 */
export async function handleListBannedWordsCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);
    const words = group.config.moderation.bannedWords.words;

    if (words.length === 0) {
        await message.reply(`📋 *Banned Words*\n\nNo banned words configured for *${group.name}*.\n\nUse \`add_banned_word <word>\` to add one.`);
        return;
    }

    const wordList = words.map((word, i) => `${i + 1}. ${word}`).join('\n');

    await message.reply(`📋 *Banned Words for ${group.name}*\n\n${wordList}\n\nStatus: ${group.config.moderation.bannedWords.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    logAdminCommand(group.id, adminId, 'list_banned_words', []);
}

/**
 * Handle view_rules command
 */
export async function handleViewRulesCommand(message, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const group = getActiveGroup(adminId);
    const rules = group.config.rules;

    if (rules.length === 0) {
        await message.reply(`📋 *Group Rules*\n\nNo rules configured for *${group.name}*.\n\nUse \`add_rule <rule>\` to add one.`);
        return;
    }

    const ruleList = rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n');

    await message.reply(`📋 *Rules for ${group.name}*\n\n${ruleList}`);
    logAdminCommand(group.id, adminId, 'view_rules', []);
}

/**
 * Handle add_rule command
 */
export async function handleAddRuleCommand(message, args, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    if (args.length === 0) {
        await message.reply('❌ Please provide a rule to add.\n\nUsage: `add_rule Be respectful to everyone`');
        return;
    }

    const rule = args.join(' ');
    const group = getActiveGroup(adminId);

    // Add rule
    group.config.rules.push(rule);
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Added rule to *${group.name}*\n\n${group.config.rules.length}. ${rule}\n\nTotal rules: ${group.config.rules.length}`);
        logAdminCommand(group.id, adminId, 'add_rule', [rule]);
    } else {
        await message.reply('❌ Failed to add rule.');
    }
}

/**
 * Handle remove_rule command
 */
export async function handleRemoveRuleCommand(message, args, client) {
    const adminId = message.from;

    if (!hasActiveContext(adminId)) {
        await promptGroupSelection(message);
        return;
    }

    const ruleNumber = parseInt(args[0]);
    const group = getActiveGroup(adminId);

    if (isNaN(ruleNumber) || ruleNumber < 1 || ruleNumber > group.config.rules.length) {
        await message.reply(`❌ Invalid rule number. Please provide a number between 1 and ${group.config.rules.length}.\n\nUse \`view_rules\` to see all rules.`);
        return;
    }

    const removedRule = group.config.rules[ruleNumber - 1];

    // Remove rule
    group.config.rules.splice(ruleNumber - 1, 1);
    const success = updateGroup(group.id, group);

    if (success) {
        await message.reply(`✅ Removed rule from *${group.name}*\n\n~~${removedRule}~~\n\nRemaining rules: ${group.config.rules.length}`);
        logAdminCommand(group.id, adminId, 'remove_rule', [ruleNumber]);
    } else {
        await message.reply('❌ Failed to remove rule.');
    }
}

/**
 * Handle help command for DM
 */
export async function handleDMHelpCommand(message, client) {
    const helpMessage = `📋 *WhatsApp Community Manager - DM Commands*

*Setup:*
• \`setup\` - Select a group to configure

*View Information:*
• \`stats\` - View group statistics
• \`settings\` - View all settings
• \`view_rules\` - View group rules
• \`list_banned_words\` - List banned words

*Configuration:*
• \`toggle_links\` - Enable/disable link blocking
• \`toggle_welcome\` - Enable/disable welcome messages
• \`set_threshold <number>\` - Set warning threshold (1-10)

*Rules Management:*
• \`add_rule <rule>\` - Add a group rule
• \`remove_rule <number>\` - Remove a rule

*Banned Words:*
• \`add_banned_word <word>\` - Add banned word
• \`remove_banned_word <word>\` - Remove banned word

*Other:*
• \`help\` - Show this help message

_Note: All commands require you to select a group first using \`setup\`_`;

    await message.reply(helpMessage);
}
