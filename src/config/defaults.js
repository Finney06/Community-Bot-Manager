/**
 * Default configuration values for the WhatsApp Community Manager
 * These settings work out-of-the-box without any user setup
 */

export const DEFAULT_CONFIG = {
    // Group identification
    groupId: null,
    groupName: null,

    // Moderation settings
    moderation: {
        // Warnings are enabled by default, auto-delete is disabled
        warningsEnabled: true,
        autoDeleteEnabled: false,
        maxWarningsBeforeAction: 3,

        // Spam detection
        spamDetection: {
            enabled: true,
            maxMessagesPerMinute: 10,
            maxRepeatedMessages: 3,
            linkBlockingEnabled: false, // Disabled by default, can be enabled with !links on
            allowedDomains: [] // Whitelist for allowed domains
        },

        // Off-topic detection
        offTopicDetection: {
            enabled: false, // Disabled until topic is set
            groupTopic: null,
            keywords: [] // Keywords related to the topic
        },

        // Banned words/phrases
        bannedWords: {
            enabled: false,
            words: []
        }
    },

    // Welcome message settings
    welcome: {
        enabled: true,
        message: `👋 Welcome to the group! Please read our rules:

1. Be respectful to all members
2. Stay on topic
3. No spam or excessive links
4. Follow group guidelines

Enjoy your stay! 🎉`
    },

    // Group rules
    rules: [
        'Be respectful to all members',
        'Stay on topic',
        'No spam or excessive links',
        'Follow group guidelines'
    ],

    // Rate limiting (automatic, invisible to users)
    rateLimits: {
        commandCooldown: 2000, // 2 seconds between commands from same user
        botMessageDelay: 1000  // 1 second delay before bot responds (appears more natural)
    }
};

/**
 * Get default config for a new group
 */
export function getDefaultConfig(groupId, groupName) {
    return {
        ...DEFAULT_CONFIG,
        groupId,
        groupName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}
