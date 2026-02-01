const express = require('express');
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Reminder = require('../models/Reminder');
const Activity = require('../models/Activity');

const router = express.Router();

// Submit review (PUBLIC - no auth, uses token)
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { rating, feedbackText } = req.body;

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: true, message: 'Rating must be between 1 and 5', code: 'INVALID_RATING' });
        }

        // Find reminder by token
        const reminder = Reminder.getByToken(token);
        if (!reminder) {
            return res.status(404).json({ error: true, message: 'Invalid or expired review link', code: 'INVALID_TOKEN' });
        }

        // Check if already submitted
        if (reminder.response_received) {
            return res.status(400).json({ error: true, message: 'Review already submitted', code: 'ALREADY_SUBMITTED' });
        }

        // Check token expiry
        if (reminder.token_expires_at && new Date(reminder.token_expires_at) < new Date()) {
            return res.status(400).json({ error: true, message: 'Review link has expired', code: 'TOKEN_EXPIRED' });
        }

        // Create review
        const review = Review.create({
            activityId: reminder.activity_id,
            studentId: reminder.student_id,
            rating: parseInt(rating),
            feedbackText: feedbackText || '',
            reviewToken: token,
            isAnonymous: true
        });

        // Mark reminder as responded
        Reminder.markResponseReceived(token);

        res.json({ message: 'Thank you for your feedback!', review });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get activity info for review page (PUBLIC - uses token)
router.get('/info/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const reminder = Reminder.getByToken(token);
        if (!reminder) {
            return res.status(404).json({ error: true, message: 'Invalid review link', code: 'INVALID_TOKEN' });
        }

        if (reminder.response_received) {
            return res.status(400).json({ error: true, message: 'Review already submitted', code: 'ALREADY_SUBMITTED' });
        }

        const activity = Activity.getById(reminder.activity_id);

        res.json({
            activity: {
                title: activity.title,
                type: activity.activity_type,
                facultyName: activity.faculty_name
            },
            studentName: reminder.student_name
        });
    } catch (error) {
        console.error('Get review info error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get reviews for an activity (auth required)
router.get('/activity/:id', auth, (req, res) => {
    try {
        const activity = Activity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ error: true, message: 'Activity not found', code: 'NOT_FOUND' });
        }

        // Check access
        if (req.user.role === 'faculty' && activity.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        const reviews = Review.getByActivityId(req.params.id);
        const avgRating = Review.getAverageRating(req.params.id);

        res.json({ reviews, ...avgRating });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get faculty review stats
router.get('/stats/faculty', auth, (req, res) => {
    try {
        const facultyId = req.user.role === 'faculty' ? req.user.id : req.query.facultyId;
        if (!facultyId) {
            return res.status(400).json({ error: true, message: 'Faculty ID required', code: 'MISSING_FACULTY_ID' });
        }

        const stats = Review.getFacultyReviewStats(facultyId);
        res.json({ stats });
    } catch (error) {
        console.error('Get faculty review stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get department review stats (admin/superadmin only)
router.get('/stats/department', auth, (req, res) => {
    try {
        if (req.user.role === 'faculty') {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        const departmentId = req.user.role === 'admin' ? req.user.department_id : req.query.departmentId;
        if (!departmentId) {
            return res.status(400).json({ error: true, message: 'Department ID required', code: 'MISSING_DEPARTMENT_ID' });
        }

        const stats = Review.getDepartmentReviewStats(departmentId);
        res.json({ stats });
    } catch (error) {
        console.error('Get department review stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
