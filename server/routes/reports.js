const express = require('express');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const User = require('../models/User');
const Department = require('../models/Department');
const Classification = require('../models/Classification');
const Activity = require('../models/Activity');
const Review = require('../models/Review');
const { generateFacultyReport, generateDepartmentReport, generateCollegeReport } = require('../utils/pdfGenerator');

const router = express.Router();

// All reports require authentication
router.use(auth);

// Get faculty report data
router.get('/faculty/:id?', async (req, res) => {
    try {
        const facultyId = req.params.id || req.user.id;

        // Faculty can only see their own report
        if (req.user.role === 'faculty' && parseInt(facultyId) !== req.user.id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        const faculty = User.getById(parseInt(facultyId));
        if (!faculty) {
            return res.status(404).json({ error: true, message: 'Faculty not found', code: 'NOT_FOUND' });
        }

        const classifications = Classification.getAll(parseInt(facultyId));
        const activities = Activity.getAll(null, parseInt(facultyId));
        const reviewStats = Review.getFacultyReviewStats(parseInt(facultyId));

        // Check if PDF download requested
        if (req.query.format === 'pdf') {
            const pdfBuffer = await generateFacultyReport(faculty, classifications, activities);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="faculty_report_${faculty.name.replace(/\s+/g, '_')}.pdf"`);
            return res.send(pdfBuffer);
        }

        // Check if CSV download requested
        if (req.query.format === 'csv') {
            let csv = 'Student Name,Roll Number,Category,Reason,Activity,Status\n';
            classifications.forEach(c => {
                const studentActivities = activities.filter(a => a.classification_id === c.id);
                if (studentActivities.length === 0) {
                    csv += `"${c.student_name}","${c.roll_number}","${c.category}","${c.reason}","No activities","N/A"\n`;
                } else {
                    studentActivities.forEach(a => {
                        csv += `"${c.student_name}","${c.roll_number}","${c.category}","${c.reason}","${a.title}","${a.completion_status}"\n`;
                    });
                }
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="faculty_report_${faculty.name.replace(/\s+/g, '_')}.csv"`);
            return res.send(csv);
        }

        res.json({
            faculty: { id: faculty.id, name: faculty.name, email: faculty.email, department: faculty.department_name },
            classifications,
            activities,
            reviewStats
        });
    } catch (error) {
        console.error('Faculty report error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get department report
router.get('/department/:id?', requireRole(['admin', 'superadmin']), async (req, res) => {
    try {
        const departmentId = req.params.id || req.user.department_id;
        const { type = 'all', semester, academicYear } = req.query;

        // Admin can only see their department
        if (req.user.role === 'admin' && parseInt(departmentId) !== req.user.department_id) {
            return res.status(403).json({ error: true, message: 'Access denied', code: 'FORBIDDEN' });
        }

        const department = Department.getById(parseInt(departmentId));
        if (!department) {
            return res.status(404).json({ error: true, message: 'Department not found', code: 'NOT_FOUND' });
        }

        let classifications = Classification.getByDepartment(parseInt(departmentId), type === 'all' ? null : type);
        let activities = Activity.getByDepartment(parseInt(departmentId));

        // Filter by semester/academic year if provided
        if (semester) {
            classifications = classifications.filter(c => c.semester === parseInt(semester));
        }
        if (academicYear) {
            classifications = classifications.filter(c => c.academic_year === academicYear);
        }

        // Get reviews for activities
        const activityIds = activities.map(a => a.id);
        const reviews = [];
        activityIds.forEach(id => {
            reviews.push(...Review.getByActivityId(id));
        });

        // Check if PDF download requested
        if (req.query.format === 'pdf') {
            const pdfBuffer = await generateDepartmentReport(department, classifications, activities, reviews, type);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="department_report_${department.name.replace(/\s+/g, '_')}.pdf"`);
            return res.send(pdfBuffer);
        }

        // Check if CSV download requested
        if (req.query.format === 'csv') {
            let csv = 'Faculty,Student Name,Roll Number,Category,Reason,Activity,Status,Rating\n';
            classifications.forEach(c => {
                const studentActivities = activities.filter(a => a.classification_id === c.id);
                if (studentActivities.length === 0) {
                    csv += `"${c.faculty_name}","${c.student_name}","${c.roll_number}","${c.category}","${c.reason}","No activities","N/A","N/A"\n`;
                } else {
                    studentActivities.forEach(a => {
                        const activityReviews = reviews.filter(r => r.activity_id === a.id);
                        const avgRating = activityReviews.length > 0
                            ? (activityReviews.reduce((sum, r) => sum + r.rating, 0) / activityReviews.length).toFixed(1)
                            : 'N/A';
                        csv += `"${c.faculty_name}","${c.student_name}","${c.roll_number}","${c.category}","${c.reason}","${a.title}","${a.completion_status}","${avgRating}"\n`;
                    });
                }
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="department_report_${department.name.replace(/\s+/g, '_')}.csv"`);
            return res.send(csv);
        }

        res.json({
            department,
            classifications,
            activities,
            reviews,
            stats: Department.getStats(parseInt(departmentId))
        });
    } catch (error) {
        console.error('Department report error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get college-wide report (superadmin only)
router.get('/college', requireRole(['superadmin']), async (req, res) => {
    try {
        const { type = 'all' } = req.query;

        const departments = Department.getAll();
        const departmentsWithStats = departments.map(dept => ({
            ...dept,
            stats: Department.getStats(dept.id)
        }));

        // Calculate totals
        const stats = {
            totalDepartments: departments.length,
            totalFaculty: departmentsWithStats.reduce((sum, d) => sum + (d.stats?.faculty_count || 0), 0),
            totalStudents: departmentsWithStats.reduce((sum, d) => sum + (d.stats?.student_count || 0), 0),
            totalWeak: departmentsWithStats.reduce((sum, d) => sum + (d.stats?.weak_count || 0), 0),
            totalStrong: departmentsWithStats.reduce((sum, d) => sum + (d.stats?.strong_count || 0), 0)
        };

        // Check if PDF download requested
        if (req.query.format === 'pdf') {
            const pdfBuffer = await generateCollegeReport(departmentsWithStats, stats);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="college_report.pdf"');
            return res.send(pdfBuffer);
        }

        // Check if CSV download requested
        if (req.query.format === 'csv') {
            let csv = 'Department,Faculty Count,Student Count,Weak Students,Strong Students\n';
            departmentsWithStats.forEach(d => {
                csv += `"${d.name}",${d.stats?.faculty_count || 0},${d.stats?.student_count || 0},${d.stats?.weak_count || 0},${d.stats?.strong_count || 0}\n`;
            });
            csv += `\n"TOTAL",${stats.totalFaculty},${stats.totalStudents},${stats.totalWeak},${stats.totalStrong}\n`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="college_report.csv"');
            return res.send(csv);
        }

        res.json({
            departments: departmentsWithStats,
            stats
        });
    } catch (error) {
        console.error('College report error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Export strong/weak students list (CSV/Excel format)
router.get('/students/export', async (req, res) => {
    try {
        const { category, department_id, format = 'csv' } = req.query;

        // Filter by department for non-superadmins
        let deptFilter = null;
        if (req.user.role !== 'superadmin') {
            deptFilter = req.user.department_id;
        } else if (department_id && department_id !== 'all') {
            deptFilter = parseInt(department_id);
        }

        // Get classifications with filters
        let classifications = Classification.getByDepartment(deptFilter, category || null);

        // Build export data
        const exportData = classifications.map(c => ({
            'Student Name': c.student_name,
            'Roll Number': c.roll_number,
            'Email': c.student_email || 'N/A',
            'Department': c.department_name || 'N/A',
            'Category': c.category.toUpperCase(),
            'Reason': c.reason,
            'Classified By': c.faculty_name,
            'Semester': c.semester || 'N/A',
            'Academic Year': c.academic_year || 'N/A',
            'Classification Date': c.classified_date ? new Date(c.classified_date).toLocaleDateString('en-IN') : 'N/A'
        }));

        if (format === 'csv') {
            // Generate CSV
            if (exportData.length === 0) {
                return res.status(404).json({ error: true, message: 'No students found with given filters' });
            }

            const headers = Object.keys(exportData[0]);
            let csv = headers.join(',') + '\n';
            exportData.forEach(row => {
                csv += headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
            });

            const categoryLabel = category || 'all';
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="students_${categoryLabel}_${Date.now()}.csv"`);
            return res.send('\ufeff' + csv); // BOM for Excel compatibility
        }

        // Return JSON for other formats
        res.json({
            count: exportData.length,
            students: exportData
        });
    } catch (error) {
        console.error('Student export error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Export activities report
router.get('/activities/export', async (req, res) => {
    try {
        const { department_id, status, format = 'csv' } = req.query;

        let deptFilter = null;
        if (req.user.role !== 'superadmin') {
            deptFilter = req.user.department_id;
        } else if (department_id && department_id !== 'all') {
            deptFilter = parseInt(department_id);
        }

        let activities = Activity.getByDepartment(deptFilter);

        // Filter by status
        if (status) {
            activities = activities.filter(a => a.completion_status === status);
        }

        const exportData = activities.map(a => ({
            'Activity Title': a.title,
            'Type': a.activity_type.replace(/_/g, ' ').toUpperCase(),
            'Student': a.student_name || 'N/A',
            'Faculty': a.faculty_name || 'N/A',
            'Department': a.department_name || 'N/A',
            'Status': a.completion_status,
            'Scheduled Date': a.scheduled_date ? new Date(a.scheduled_date).toLocaleDateString('en-IN') : 'N/A',
            'Completed At': a.completed_at ? new Date(a.completed_at).toLocaleDateString('en-IN') : 'N/A'
        }));

        if (format === 'csv') {
            if (exportData.length === 0) {
                return res.status(404).json({ error: true, message: 'No activities found with given filters' });
            }

            const headers = Object.keys(exportData[0]);
            let csv = headers.join(',') + '\n';
            exportData.forEach(row => {
                csv += headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="activities_report_${Date.now()}.csv"`);
            return res.send('\ufeff' + csv);
        }

        res.json({
            count: exportData.length,
            activities: exportData
        });
    } catch (error) {
        console.error('Activities export error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
