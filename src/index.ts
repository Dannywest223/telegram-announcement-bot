import dotenv from 'dotenv';
dotenv.config();

import { startBot } from './bot';
import './health';

console.log('🚀 Starting bot...');

const bot = startBot();

process.once('SIGINT', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGTERM');
    process.exit(0);
});