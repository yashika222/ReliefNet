const logger = require('./logger');

const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
];

const optionalVars = [
    'PORT',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_SERVICE',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_SECURE',
    'EMAIL_FROM',
    'BASE_URL',
    'APP_NAME',
];

function validateEnv() {
    const missing = [];
    const warnings = [];

    // Check required variables
    requiredVars.forEach((key) => {
        if (!process.env[key]) {
            missing.push(key);
        }
    });

    // Check optional variables (logs warning only)
    optionalVars.forEach((key) => {
        if (!process.env[key]) {
            warnings.push(key);
        }
    });

    if (warnings.length > 0) {
        logger.warn(`Missing optional environment variables: ${warnings.join(', ')}`);
    }

    if (missing.length > 0) {
        logger.error(`CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
        // We do NOT exit here to prevent crash loops, but functionality will be broken.
        // In strict production setups, you might want to exit: process.exit(1);
        // For now, we return false to let the caller decide.
        return false;
    }

    logger.info('Environment variables validated successfully.');
    return true;
}

module.exports = { validateEnv };
