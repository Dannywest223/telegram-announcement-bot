import dotenv from 'dotenv';
dotenv.config();

import { startBot } from './bot';

// Start health check server
import './health';

console.log('🚀 Starting bot...');

// Start the bot
startBot();

// Handle graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down...');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    process.exit(0);
});