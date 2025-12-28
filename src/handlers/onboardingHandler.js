/**
 * Onboarding Handler
 * Manages the step-by-step guided experience for admins
 */

import {
    getOnboardingSession,
    setOnboardingSession,
    clearOnboardingSession,
    getGroup,
    updateGroup,
    setAdminContext
} from '../storage/storage.js';
import { logger } from '../utils/logger.js';

/**
 * Onboarding Steps Definition
 */
const STEPS = {
    WELCOME: 'welcome',
    CORE_FEATURES: 'core_features',
    RULES: 'rules',
    SUMMARY: 'summary'
};

/**
 * Start onboarding for an admin
 */
export async function startOnboarding(adminId, groupId, client) {
    const group = getGroup(groupId);
    if (!group) return;

    const session = {
        adminId,
        groupId,
        step: STEPS.WELCOME,
        completedSteps: []
    };

    setOnboardingSession(adminId, session);
    setAdminContext(adminId, groupId);

    await sendStepMessage(adminId, STEPS.WELCOME, groupId, client);
}

/**
 * Handle messages during onboarding
 */
export async function handleOnboardingMessage(message, client) {
    const adminId = message.from;
    const session = getOnboardingSession(adminId);

    if (!session) return false;

    const body = message.body.trim().toLowerCase();

    // Allow restarting or skipping
    if (body === 'restart') {
        session.step = STEPS.WELCOME;
        session.completedSteps = [];
        setOnboardingSession(adminId, session);
        await sendStepMessage(adminId, STEPS.WELCOME, session.groupId, client);
        return true;
    }

    if (body === 'quit' || body === 'exit' || body === 'stop') {
        clearOnboardingSession(adminId);
        await message.reply('👋 Onboarding stopped. You can continue later by sending `setup`.');
        return true;
    }

    // Process current step
    switch (session.step) {
        case STEPS.WELCOME:
            // Any message moves to next step
            session.step = STEPS.CORE_FEATURES;
            break;

        case STEPS.CORE_FEATURES:
            if (body === '1' || body === 'yes' || body === 'enable links') {
                await toggleLinkBlocking(session.groupId, true);
                session.completedSteps.push('links_enabled');
            } else if (body === '2' || body === 'no' || body === 'skip') {
                await toggleLinkBlocking(session.groupId, false);
                session.completedSteps.push('links_disabled');
            } else {
                await message.reply('Please reply with *1* (Yes) or *2* (No/Skip).');
                return true;
            }
            session.step = STEPS.RULES;
            break;

        case STEPS.RULES:
            if (body !== 'skip' && body !== 'next') {
                await addFirstRule(session.groupId, message.body.trim());
                session.completedSteps.push('rule_added');
            }
            session.step = STEPS.SUMMARY;
            break;

        case STEPS.SUMMARY:
            clearOnboardingSession(adminId);
            await message.reply('🎉 All set! Your group is now protected. Send `help` at any time to see what else I can do.');
            return true;

        default:
            clearOnboardingSession(adminId);
            return false;
    }

    setOnboardingSession(adminId, session);
    await sendStepMessage(adminId, session.step, session.groupId, client);
    return true;
}

/**
 * Send the message for a specific step
 */
async function sendStepMessage(adminId, step, groupId, client) {
    const group = getGroup(groupId);
    if (!group) return;

    let text = '';
    const progressMap = {
        [STEPS.WELCOME]: '⚪⚪⚪',
        [STEPS.CORE_FEATURES]: '🔵⚪⚪',
        [STEPS.RULES]: '🔵🔵⚪',
        [STEPS.SUMMARY]: '🔵🔵🔵'
    };
    const progress = progressMap[step] || '';

    switch (step) {
        case STEPS.WELCOME:
            text = `👋 *Welcome to Community Bot!*
${progress}

I've been added to *${group.name}* to help you keep things organized and safe. 

This is a quick guided setup to get us started. Don't worry, I work out-of-the-box with safe defaults!

*Next step:* Reply with anything to continue.`;
            break;

        case STEPS.CORE_FEATURES:
            text = `🛡️ *Step 1: Core Protection*
${progress}

By default, I detect spam and welcome new members. 

Would you also like me to *automatically block all links* sent by non-admins? This is great for preventing promotional spam.

1️⃣ *Yes, block links*
2️⃣ *No / Skip for now*

_Reply with 1 or 2_`;
            break;

        case STEPS.RULES:
            text = `📋 *Step 2: Group Rules*
${progress}

I can remind members of the rules if they misbehave. 

*What's the most important rule for ${group.name}?*
(e.g., "No offensive language" or "Stay on topic")

_Type your rule now, or send *skip* to do this later._`;
            break;

        case STEPS.SUMMARY:
            const linksStatus = group.config.moderation.spamDetection.linkBlockingEnabled ? '✅ Enabled' : '❌ Disabled';
            const rulesCount = group.config.rules ? group.config.rules.length : 0;

            text = `🎉 *Configuration Complete!*
${progress}

Here's your current setup for *${group.name}*:

🤖 *Active Features:*
• Spam Detection: ✅ *Active*
• Welcome Messages: ✅ *Active*
• Link Blocking: ${linksStatus}
• Rules Configured: *${rulesCount}*

*How to manage:*
• Send \`settings\` to see all details
• Send \`stats\` to see group activity
• Send \`setup\` to switch groups

_I'm now monitoring your group. Have fun!_

Reply with *finish* to close this guide.`;
            break;
    }

    try {
        const chat = await client.getChatById(adminId);
        await chat.sendMessage(text);
    } catch (error) {
        logger.error(`Failed to send onboarding message to ${adminId}:`, error);
    }
}

/**
 * Helper: Toggle link blocking
 */
async function toggleLinkBlocking(groupId, enabled) {
    const group = getGroup(groupId);
    if (group) {
        group.config.moderation.spamDetection.linkBlockingEnabled = enabled;
        updateGroup(groupId, group);
    }
}

/**
 * Helper: Add first rule
 */
async function addFirstRule(groupId, rule) {
    const group = getGroup(groupId);
    if (group) {
        if (!group.config.rules) group.config.rules = [];
        group.config.rules.push(rule);
        updateGroup(groupId, group);
    }
}
