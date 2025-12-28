/**
 * Test Onboarding Script
 * Mocks WhatsApp client to verify the onboarding flow
 */

import { initStorage, getGroup, saveGroup, clearOnboardingSession } from '../src/storage/storage.js';
import { handleOnboardingMessage, startOnboarding } from '../src/handlers/onboardingHandler.js';
import { getDefaultConfig } from '../src/config/defaults.js';

// Mock objects
const mockClient = {
    getChatById: async (id) => ({
        sendMessage: async (text) => {
            console.log(`\n[BOT to ${id}]:\n${text}\n-------------------`);
        }
    })
};

// Mock message
function createMockMessage(adminId, body) {
    return {
        from: adminId,
        body: body,
        reply: async (text) => {
            console.log(`\n[BOT REPLY to ${adminId}]:\n${text}\n-------------------`);
        }
    };
}

async function runTest() {
    console.log('🚀 Starting Onboarding Verification Test...');

    // Initialize storage
    initStorage();

    const adminId = 'test_admin_id';
    const groupId = 'test_group_id';

    // Clear previous sessions
    clearOnboardingSession(adminId);

    // Setup mock group
    const groupData = {
        id: groupId,
        name: 'Test Tech Hub',
        admins: [adminId],
        config: getDefaultConfig(groupId, 'Test Tech Hub'),
        active: true
    };
    saveGroup(groupId, groupData);

    // 1. Start Onboarding
    console.log('\n--- Action: Starting Onboarding ---');
    await startOnboarding(adminId, groupId, mockClient);

    // 2. Reply to Welcome (Step 1 -> 2)
    console.log('\n--- Action: Replying to Welcome ---');
    await handleOnboardingMessage(createMockMessage(adminId, 'hello'), mockClient);

    // 3. Enable Link Blocking (Step 2 -> 3)
    console.log('\n--- Action: Selecting YES for Link Blocking ---');
    await handleOnboardingMessage(createMockMessage(adminId, '1'), mockClient);

    // Verify config change
    const groupAfterLinks = getGroup(groupId);
    console.log(`Config Check - Link Blocking: ${groupAfterLinks.config.moderation.spamDetection.linkBlockingEnabled}`);

    // 4. Add Rule (Step 3 -> 4)
    console.log('\n--- Action: Adding a Rule ---');
    await handleOnboardingMessage(createMockMessage(adminId, 'Be nice to each other'), mockClient);

    // Verify rule added
    const groupAfterRule = getGroup(groupId);
    console.log(`Config Check - Rules Count: ${groupAfterRule.config.rules.length}`);
    console.log(`Rule content: ${groupAfterRule.config.rules[5]}`); // Index 5 if default has 5 rules

    // 5. Finish (Step 4 -> End)
    console.log('\n--- Action: Finishing ---');
    await handleOnboardingMessage(createMockMessage(adminId, 'next'), mockClient);

    console.log('\n✅ Verification Test Complete!');
}

runTest().catch(console.error);
