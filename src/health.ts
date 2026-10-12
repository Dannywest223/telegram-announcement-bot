import express from 'express';

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

// Health check endpoint for Render and UptimeRobot
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).send('🤖 Telegram Announcement Bot is running!');
});

// Catch-all route
app.get('*', (req, res) => {
    res.status(200).send('Bot is operational');
});

// Start server - bind to all interfaces
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Health check server running on port ${PORT}`);
    console.log(`🌐 Health check URL: http://0.0.0.0:${PORT}/health`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing health server...');
    server.close(() => {
        console.log('Health server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing health server...');
    server.close(() => {
        console.log('Health server closed');
        process.exit(0);
    });
});