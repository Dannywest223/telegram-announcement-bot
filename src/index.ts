import dotenv from 'dotenv';
dotenv.config();

import { startBot } from './bot';
import './health'; // Add this line

console.log('🚀 Starting bot...');
startBot();

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));