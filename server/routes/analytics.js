// Analytics Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const db = require('../config/database').getDb;

// Get analytics summary
router.get('/summary', auth, async (req, res) => {
    try {
        const user = req.user;

        // Build department filter based on role
        let departmentFilter = '';
        const params = [];

        if (user.role !== 'superadmin') {
            departmentFilter = 'WHERE sc.department_id = ?';
            params.push(user.department_id);
        }

        // Get activity statistics
        const activityStats = db().prepare(`
            SELECT 
                COUNT(*) as total_activities,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_activities
            FROM activities a
            JOIN student_classifications sc ON a.classification_id = sc.id
            ${departmentFilter}
        `).get(...params) || { total_activities: 0, completed_activities: 0 };

        // Get generated activity stats by type
        const activityTypeStats = db().prepare(`
            SELECT 
                activity_type,
                COUNT(*) as count
            FROM generated_activities
            GROUP BY activity_type
        `).all();

        // Get session statistics
        const sessionStats = db().prepare(`
            SELECT 
                COUNT(*) as total_sessions,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
                ROUND(AVG(score), 1) as avg_score,
                SUM(time_spent_seconds) as total_time_seconds
            FROM student_activity_sessions
        `).get() || { total_sessions: 0, completed_sessions: 0, avg_score: 0, total_time_seconds: 0 };

        // Get classification stats - strong/weak
        const classificationStats = db().prepare(`
            SELECT 
                category,
                COUNT(*) as count
            FROM student_classifications sc
            ${departmentFilter}
            GROUP BY category
        `).all(...params);

        // Get top activities by engagement
        const topActivities = db().prepare(`
            SELECT 
                ga.title,
                ga.activity_type,
                COUNT(sas.id) as attempts,
                ROUND(AVG(sas.score), 1) as avg_score,
                ROUND(SUM(CASE WHEN sas.completed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(sas.id), 1) as completion_rate
            FROM generated_activities ga
            LEFT JOIN activity_assignments aa ON ga.id = aa.activity_id
            LEFT JOIN student_activity_sessions sas ON aa.id = sas.assignment_id
            GROUP BY ga.id
            HAVING attempts > 0
            ORDER BY attempts DESC, avg_score DESC
            LIMIT 10
        `).all();

        // Get faculty stats
        const facultyStats = db().prepare(`
            SELECT 
                u.name as faculty_name,
                COUNT(DISTINCT ga.id) as activities_created,
                COUNT(DISTINCT sas.id) as total_sessions,
                ROUND(AVG(CASE WHEN sas.completed = 1 THEN 100 ELSE 0 END), 1) as avg_completion
            FROM users u
            LEFT JOIN generated_activities ga ON u.id = ga.faculty_id
            LEFT JOIN activity_assignments aa ON ga.id = aa.activity_id
            LEFT JOIN student_activity_sessions sas ON aa.id = sas.assignment_id
            WHERE u.role = 'faculty' AND u.is_active = 1
            GROUP BY u.id
            ORDER BY activities_created DESC
            LIMIT 10
        `).all();

        // Build response
        const byCategory = {};
        classificationStats.forEach(stat => {
            byCategory[stat.category] = stat.count;
        });

        const byType = {};
        activityTypeStats.forEach(stat => {
            byType[stat.activity_type] = stat.count;
        });

        // Format time
        const totalTimeSeconds = sessionStats.total_time_seconds || 0;
        const hours = Math.floor(totalTimeSeconds / 3600);
        const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
        const totalTimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        const completionRate = sessionStats.total_sessions > 0
            ? Math.round((sessionStats.completed_sessions / sessionStats.total_sessions) * 100)
            : 0;

        res.json({
            totalActivities: activityStats.total_activities,
            totalGenerated: Object.values(byType).reduce((a, b) => a + b, 0),
            totalSessions: sessionStats.total_sessions,
            completedSessions: sessionStats.completed_sessions,
            completionRate: `${completionRate}%`,
            avgScore: sessionStats.avg_score ? `${sessionStats.avg_score}%` : 'N/A',
            totalTime: totalTimeFormatted,
            byCategory,
            byType,
            topActivities,
            facultyStats
        });
    } catch (error) {
        console.error('Analytics summary error:', error);
        res.status(500).json({ error: true, message: 'Failed to load analytics' });
    }
});

// Get time-series analytics data
router.get('/trends', auth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get activity completions per day
        const dailyStats = db().prepare(`
            SELECT 
                DATE(completed_at) as date,
                COUNT(*) as completions,
                ROUND(AVG(score), 1) as avg_score
            FROM student_activity_sessions
            WHERE completed_at >= ? AND completed = 1
            GROUP BY DATE(completed_at)
            ORDER BY date
        `).all(startDate.toISOString());

        res.json({
            period: { start: startDate.toISOString(), end: endDate.toISOString() },
            dailyStats
        });
    } catch (error) {
        console.error('Trends error:', error);
        res.status(500).json({ error: true, message: 'Failed to load trends' });
    }
});

module.exports = router;
