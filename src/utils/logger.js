/**
 * Simple logging utility for the WhatsApp bot
 * Provides timestamped console logs with different severity levels
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

const COLORS = {
  INFO: '\x1b[36m',    // Cyan
  WARN: '\x1b[33m',    // Yellow
  ERROR: '\x1b[31m',   // Red
  SUCCESS: '\x1b[32m', // Green
  RESET: '\x1b[0m'
};

/**
 * Get formatted timestamp
 */
function getTimestamp() {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Log a message with specified level
 */
function log(level, message, data = null) {
  const timestamp = getTimestamp();
  const color = COLORS[level] || COLORS.INFO;
  const reset = COLORS.RESET;
  
  let logMessage = `${color}[${timestamp}] [${level}]${reset} ${message}`;
  
  console.log(logMessage);
  
  // If additional data is provided, log it as well
  if (data !== null && data !== undefined) {
    console.log(data);
  }
}

/**
 * Public logging methods
 */
export const logger = {
  info: (message, data) => log(LOG_LEVELS.INFO, message, data),
  warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
  error: (message, data) => log(LOG_LEVELS.ERROR, message, data),
  success: (message, data) => log(LOG_LEVELS.SUCCESS, message, data)
};
