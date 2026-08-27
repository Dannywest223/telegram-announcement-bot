import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Root route
app.get('/', (req, res) => {
    res.send('🤖 Telegram Announcement Bot is running!');
});

// Health check route (for Render and UptimeRobot)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Handle any other routes
app.get('*', (req, res) => {
    res.status(200).send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`✅ Health check server running on port ${PORT}`);
});