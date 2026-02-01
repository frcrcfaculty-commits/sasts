const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { requireClassificationOwnership } = require('../middleware/roleCheck');
const Activity = require('../models/Activity');
const Classification = require('../models/Classification');
const Student = require('../models/Student');
const Reminder = require('../models/Reminder');
const { sendReviewRequest } = require('../utils/email');

const router = express.Router();

// Valid activity types per category
const WEAK_ACTIVITY_TYPES = ['notes', 'lecture', 'interactive'];
const STRONG_ACTIVITY_TYPES = ['nptel_course', 'assignment', 'tutorial', 'extra_course'];

// Get all activities
router.get('/', auth, (req, res) => {
    try {
        const { classificationId, status } = req.query;

        let activities;
        if (req.user.role === 'faculty') {
            activities = Activity.getAll(classificationId, req.user.id);
        } else if (req.user.role === 'admin') {
            activities = Activity.getByDepartment(req.user.department_id, status);
        } else {
            // Superadmin - get all or by department
            const departmentId = req.query.departmentId;
            if (departmentId) {
                activities = Activity.getByDepartment(departmentId, status);
            } else {
                activities = Activity.getAll(classificationId);
            }
        }

        res.json({ activities });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get activity by ID
router.get('/:id', auth, (req, res) => {
    try {
        const activity = Activity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ error: true, message: 'Activity not found', code: 'NOT_FOUND' });
        }

        // Check access
        if (req.user.role === 'faculty' && activity.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        res.json({ activity });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Create activity
router.post('/', auth, (req, res) => {
    try {
        const { classificationId, activityType, title, description, scheduledDate } = req.body;

        // Validation
        if (!classificationId || !activityType || !title || !description) {
            return res.status(400).json({ error: true, message: 'All fields are required', code: 'MISSING_FIELDS' });
        }

        if (description.length < 50) {
            return res.status(400).json({ error: true, message: 'Description must be at least 50 characters', code: 'DESCRIPTION_TOO_SHORT' });
        }

        // Check classification exists and ownership
        const classification = Classification.getById(classificationId);
        if (!classification) {
            return res.status(404).json({ error: true, message: 'Classification not found', code: 'CLASSIFICATION_NOT_FOUND' });
        }

        if (req.user.role === 'faculty' && classification.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'You can only add activities to your own classifications', code: 'FORBIDDEN' });
        }

        // Validate activity type for category
        const validTypes = classification.category === 'weak' ? WEAK_ACTIVITY_TYPES : STRONG_ACTIVITY_TYPES;
        if (!validTypes.includes(activityType)) {
            return res.status(400).json({
                error: true,
                message: `Invalid activity type for ${classification.category} students. Valid types: ${validTypes.join(', ')}`,
                code: 'INVALID_ACTIVITY_TYPE'
            });
        }

        const activity = Activity.create({
            classificationId,
            activityType,
            title,
            description,
            scheduledDate
        });

        res.status(201).json({ message: 'Activity created', activity });
    } catch (error) {
        console.error('Create activity error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Update activity
router.put('/:id', auth, (req, res) => {
    try {
        const activity = Activity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ error: true, message: 'Activity not found', code: 'NOT_FOUND' });
        }

        if (req.user.role === 'faculty' && activity.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        if (activity.completion_status === 'completed') {
            return res.status(400).json({ error: true, message: 'Cannot edit completed activity', code: 'ACTIVITY_COMPLETED' });
        }

        const { title, description, scheduledDate } = req.body;

        if (description && description.length < 50) {
            return res.status(400).json({ error: true, message: 'Description must be at least 50 characters', code: 'DESCRIPTION_TOO_SHORT' });
        }

        const updated = Activity.update(req.params.id, { title, description, scheduledDate });
        res.json({ message: 'Activity updated', activity: updated });
    } catch (error) {
        console.error('Update activity error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Mark activity as completed (triggers email)
router.post('/:id/complete', auth, async (req, res) => {
    try {
        const activity = Activity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ error: true, message: 'Activity not found', code: 'NOT_FOUND' });
        }

        if (req.user.role === 'faculty' && activity.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        if (activity.completion_status === 'completed') {
            return res.status(400).json({ error: true, message: 'Activity already completed', code: 'ALREADY_COMPLETED' });
        }

        // Mark as completed
        const updated = Activity.markCompleted(req.params.id);

        // Get student for email
        const student = Student.getById(activity.student_id);

        // Generate review token
        const reviewToken = uuidv4();
        const tokenExpiry = new Date();
        tokenExpiry.setDate(tokenExpiry.getDate() + 7); // Token valid for 7 days

        // Create reminder record
        Reminder.create({
            activityId: activity.id,
            studentId: student.id,
            reviewToken,
            tokenExpiresAt: tokenExpiry.toISOString()
        });

        // Send email (async, don't block response)
        sendReviewRequest(student, updated, reviewToken).catch(err => {
            console.error('Failed to send review email:', err);
        });

        res.json({
            message: 'Activity marked as completed. Review request sent to student.',
            activity: updated
        });
    } catch (error) {
        console.error('Complete activity error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Delete activity
router.delete('/:id', auth, (req, res) => {
    try {
        const activity = Activity.getById(req.params.id);
        if (!activity) {
            return res.status(404).json({ error: true, message: 'Activity not found', code: 'NOT_FOUND' });
        }

        if (req.user.role === 'faculty' && activity.faculty_id !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        Activity.delete(req.params.id);
        res.json({ message: 'Activity deleted' });
    } catch (error) {
        console.error('Delete activity error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get activity stats
router.get('/stats/summary', auth, (req, res) => {
    try {
        const facultyId = req.user.role === 'faculty' ? req.user.id : null;
        const departmentId = req.user.role === 'superadmin' ? null : req.user.department_id;

        const stats = Activity.getStats(facultyId, departmentId);
        const typeBreakdown = Activity.getTypeBreakdown(facultyId, departmentId);

        res.json({ stats, typeBreakdown });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
