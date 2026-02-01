require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./config/database');
const { initTransporter } = require('./utils/email');

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const activityRoutes = require('./routes/activities');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const facultyRoutes = require('./routes/faculty');
const studentAuthRoutes = require('./routes/student');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true, // Allow all origins for localhost
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentAuthRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI status endpoint
app.get('/api/ai/status', async (req, res) => {
    try {
        const aiService = require('./services/ai');
        const available = await aiService.isOllamaAvailable();
        res.json({
            available,
            model: process.env.AI_MODEL || 'llama3.1',
            endpoint: process.env.OLLAMA_URL || 'http://localhost:11434'
        });
    } catch {
        res.json({ available: false });
    }
});

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: true,
        message: err.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
    });
});

// Initialize and start server
const startServer = async () => {
    try {
        // Initialize database
        console.log('🔄 Initializing database...');
        await initDatabase();

        // Initialize email transporter
        console.log('🔄 Initializing email service...');
        initTransporter();

        // Check AI availability
        const aiService = require('./services/ai');
        const aiAvailable = await aiService.isOllamaAvailable();
        console.log(aiAvailable ? '🤖 AI service connected (Ollama)' : '⚠️  AI service not available');

        // Start server - bind to 0.0.0.0 for local network access
        app.listen(PORT, '0.0.0.0', () => {
            console.log('\n✅ SASTS v2 Server Started Successfully!\n');
            console.log(`📍 Local:    http://localhost:${PORT}`);
            console.log(`📍 Network:  http://0.0.0.0:${PORT}`);
            console.log('\n📋 Default Super Admin Credentials:');
            console.log('   Email:    principal@fcrit.ac.in');
            console.log('   Password: Principal@2026');
            console.log('\n🔗 API Endpoints:');
            console.log('   POST /api/auth/login           (Faculty/Admin login)');
            console.log('   POST /api/student/login        (Student login)');
            console.log('   GET  /api/faculty/syllabus     (Upload syllabus)');
            console.log('   POST /api/faculty/activities/generate (AI activities)');
            console.log('   GET  /api/ai/status            (Check AI availability)\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
