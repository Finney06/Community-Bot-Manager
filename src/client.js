/**
 * WhatsApp Client Wrapper
 * Handles client initialization, authentication, and connection management
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { logger } from './utils/logger.js';

let client = null;

/**
 * Initialize WhatsApp client with session persistence
 */
export function createClient() {
    logger.info('Initializing WhatsApp client...');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    setupClientEvents();

    return client;
}

/**
 * Set up client event handlers
 */
function setupClientEvents() {
    // QR Code generation
    client.on('qr', (qr) => {
        logger.info('QR Code received! Scan with your WhatsApp mobile app:');
        console.log(''); // Empty line for spacing
        qrcode.generate(qr, { small: true });
        console.log(''); // Empty line for spacing
        logger.info('Waiting for QR code scan...');
    });

    // Authentication success
    client.on('authenticated', () => {
        logger.success('Authentication successful!');
    });

    // Client ready
    client.on('ready', () => {
        logger.success('WhatsApp bot is ready! 🚀');
        logger.info(`Logged in as: ${client.info.pushname}`);
    });

    // Authentication failure
    client.on('auth_failure', (msg) => {
        logger.error('Authentication failed:', msg);
    });

    // Disconnection
    client.on('disconnected', (reason) => {
        logger.warn('Client disconnected:', reason);
        logger.info('Attempting to reconnect...');
    });

    // Loading screen updates
    client.on('loading_screen', (percent, message) => {
        logger.info(`Loading: ${percent}% - ${message}`);
    });
}

/**
 * Get the client instance
 */
export function getClient() {
    return client;
}

/**
 * Initialize and start the client
 */
export async function initializeClient() {
    try {
        logger.info('Starting WhatsApp client initialization...');
        await client.initialize();
    } catch (error) {
        logger.error('Error initializing client:', error);
        throw error;
    }
}
