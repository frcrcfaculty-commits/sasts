const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const StudentAuth = require('../models/StudentAuth');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const GeneratedActivity = require('../models/GeneratedActivity');
const StudentSession = require('../models/StudentSession');

// Student login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const studentAuth = StudentAuth.getByEmail(email);
        if (!studentAuth) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!studentAuth.is_active) {
            return res.status(401).json({ message: 'Account is deactivated' });
        }

        if (!StudentAuth.verifyPassword(studentAuth, password)) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Update login stats
        StudentAuth.updateLoginStats(studentAuth.id);

        // Generate token
        const token = jwt.sign(
            {
                id: studentAuth.student_id,
                authId: studentAuth.id,
                email: studentAuth.email,
                name: studentAuth.name,
                role: 'student',
                departmentId: studentAuth.department_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
        );

        res.json({
            token,
            user: {
                id: studentAuth.student_id,
                authId: studentAuth.id,
                name: studentAuth.name,
                email: studentAuth.email,
                rollNumber: studentAuth.roll_number,
                role: 'student',
                departmentId: studentAuth.department_id,
                departmentName: studentAuth.department_name,
                semester: studentAuth.semester,
                year: studentAuth.year
            }
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Get current student profile
router.get('/me', requireStudentAuth, (req, res) => {
    try {
        const studentAuth = StudentAuth.getByStudentId(req.user.id);
        if (!studentAuth) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const stats = StudentSession.getStudentStats(req.user.id);

        res.json({
            user: {
                id: studentAuth.student_id,
                name: studentAuth.name,
                email: studentAuth.email,
                rollNumber: studentAuth.roll_number,
                departmentName: studentAuth.department_name,
                semester: studentAuth.semester,
                year: studentAuth.year,
                totalTimeSpent: studentAuth.total_time_spent,
                visitCount: studentAuth.visit_count,
                lastLogin: studentAuth.last_login
            },
            stats
        });
    } catch (error) {
        console.error('Get student profile error:', error);
        res.status(500).json({ message: 'Failed to get profile' });
    }
});

// Get notifications
router.get('/notifications', requireStudentAuth, (req, res) => {
    try {
        const unreadOnly = req.query.unread === 'true';
        const notifications = Notification.getForRecipient('student', req.user.id, unreadOnly);
        const unreadCount = Notification.getUnreadCount('student', req.user.id);

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Failed to get notifications' });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', requireStudentAuth, (req, res) => {
    try {
        Notification.markAsRead(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark as read' });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', requireStudentAuth, (req, res) => {
    try {
        Notification.markAllAsRead('student', req.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
});

// Get assigned activities
router.get('/activities', requireStudentAuth, (req, res) => {
    try {
        const activities = GeneratedActivity.getStudentActivities(req.user.id);
        res.json({ activities });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ message: 'Failed to get activities' });
    }
});

// Get single activity with content
router.get('/activities/:id', requireStudentAuth, (req, res) => {
    try {
        const activity = GeneratedActivity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ message: 'Activity not found' });
        }

        // Parse content JSON
        let content;
        try {
            content = JSON.parse(activity.content);
        } catch {
            content = activity.content;
        }

        res.json({
            activity: {
                ...activity,
                content
            }
        });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ message: 'Failed to get activity' });
    }
});

// Start activity session
router.post('/activities/:id/start', requireStudentAuth, (req, res) => {
    try {
        const session = StudentSession.startSession(req.user.id, req.params.id);
        res.json({ session });
    } catch (error) {
        console.error('Start session error:', error);
        res.status(500).json({ message: 'Failed to start session' });
    }
});

// Submit activity answers
router.post('/activities/:id/submit', requireStudentAuth, (req, res) => {
    try {
        const { sessionId, answers, timeSpent, score, maxScore } = req.body;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID required' });
        }

        const session = StudentSession.endSession(sessionId, {
            timeSpent,
            score,
            maxScore,
            answers,
            completed: true
        });

        // Update student's total time
        if (timeSpent) {
            StudentAuth.addTimeSpent(req.user.authId, timeSpent);
        }

        // Notify faculty if score is available
        if (score !== undefined) {
            const activity = GeneratedActivity.getById(req.params.id);
            if (activity) {
                Notification.notifyFacultyOfCompletion(
                    activity.faculty_id,
                    req.user.name,
                    activity.title,
                    score,
                    maxScore
                );
            }
        }

        res.json({
            success: true,
            session,
            message: 'Activity completed successfully!'
        });
    } catch (error) {
        console.error('Submit activity error:', error);
        res.status(500).json({ message: 'Failed to submit activity' });
    }
});

// Get activity history
router.get('/history', requireStudentAuth, (req, res) => {
    try {
        const sessions = StudentSession.getByStudent(req.user.id);
        const stats = StudentSession.getStudentStats(req.user.id);

        res.json({ sessions, stats });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ message: 'Failed to get history' });
    }
});

// Update time spent (heartbeat)
router.post('/heartbeat', requireStudentAuth, (req, res) => {
    try {
        const { seconds } = req.body;
        if (seconds && seconds > 0) {
            StudentAuth.addTimeSpent(req.user.authId, seconds);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update' });
    }
});

// Student auth middleware
function requireStudentAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'student') {
            return res.status(403).json({ message: 'Student access required' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
}

module.exports = router;
