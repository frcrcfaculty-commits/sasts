const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Syllabus = require('../models/Syllabus');
const GeneratedActivity = require('../models/GeneratedActivity');
const SemesterMarks = require('../models/SemesterMarks');
const AISuggestion = require('../models/AISuggestion');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Classification = require('../models/Classification');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const aiService = require('../services/ai');

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.csv', '.xlsx', '.xls', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, CSV, Excel, TXT'));
        }
    }
});

// ==================== SYLLABUS ROUTES ====================

// Get all syllabi for faculty
router.get('/syllabus', auth, (req, res) => {
    try {
        const syllabi = Syllabus.getAll(req.user.id);
        res.json({ syllabi });
    } catch (error) {
        console.error('Get syllabi error:', error);
        res.status(500).json({ message: 'Failed to get syllabi' });
    }
});

// Get single syllabus with modules
router.get('/syllabus/:id', auth, (req, res) => {
    try {
        const syllabus = Syllabus.getById(req.params.id);
        if (!syllabus) {
            return res.status(404).json({ message: 'Syllabus not found' });
        }

        const modules = Syllabus.getModules(req.params.id);

        res.json({
            syllabus,
            modules
        });
    } catch (error) {
        console.error('Get syllabus error:', error);
        res.status(500).json({ message: 'Failed to get syllabus' });
    }
});

// Upload and parse syllabus
router.post('/syllabus/upload', auth, upload.single('file'), async (req, res) => {
    try {
        const { courseName, courseCode } = req.body;

        if (!courseName) {
            return res.status(400).json({ message: 'Course name required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'File required' });
        }

        // Read file content
        let fileContent = '';
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext === '.txt') {
            fileContent = fs.readFileSync(req.file.path, 'utf-8');
        } else if (ext === '.pdf') {
            // For PDF, we'd need a PDF parser - use placeholder for now
            fileContent = `Course: ${courseName}\nFile: ${req.file.originalname}\n[PDF content would be extracted here]`;
        } else if (ext === '.csv') {
            fileContent = fs.readFileSync(req.file.path, 'utf-8');
        }

        // Parse syllabus with AI (if available)
        let parsedModules = [];
        const ollamaAvailable = await aiService.isOllamaAvailable();

        if (ollamaAvailable && fileContent.length > 100) {
            const parsed = await aiService.parseSyllabusContent(fileContent, courseName);
            parsedModules = parsed.modules || [];
        }

        // Create syllabus record
        const syllabus = Syllabus.create({
            facultyId: req.user.id,
            departmentId: req.user.departmentId,
            courseName,
            courseCode,
            fileName: req.file.originalname,
            parsedModules
        });

        // Add modules to database
        for (const mod of parsedModules) {
            Syllabus.addModule({
                syllabusId: syllabus.id,
                moduleNumber: mod.number,
                moduleName: mod.name,
                topics: JSON.stringify(mod.topics || []),
                hours: mod.hours || 0
            });
        }

        res.json({
            syllabus,
            modules: Syllabus.getModules(syllabus.id),
            aiParsed: ollamaAvailable
        });
    } catch (error) {
        console.error('Upload syllabus error:', error);
        res.status(500).json({ message: 'Failed to upload syllabus' });
    }
});

// Add module manually
router.post('/syllabus/:id/modules', auth, (req, res) => {
    try {
        const { moduleNumber, moduleName, topics, hours } = req.body;

        const module = Syllabus.addModule({
            syllabusId: req.params.id,
            moduleNumber,
            moduleName,
            topics: JSON.stringify(topics || []),
            hours: hours || 0
        });

        res.json({ module });
    } catch (error) {
        console.error('Add module error:', error);
        res.status(500).json({ message: 'Failed to add module' });
    }
});

// Delete syllabus
router.delete('/syllabus/:id', auth, (req, res) => {
    try {
        Syllabus.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete syllabus' });
    }
});

// ==================== ACTIVITY GENERATION ROUTES ====================

// Generate activity from module
router.post('/activities/generate', auth, async (req, res) => {
    try {
        const { syllabusId, moduleId, activityType, title, difficulty, questionCount } = req.body;

        if (!syllabusId || !activityType) {
            return res.status(400).json({ message: 'Syllabus ID and activity type required' });
        }

        const syllabus = Syllabus.getById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ message: 'Syllabus not found' });
        }

        let moduleContent = '';
        let moduleName = syllabus.course_name;

        if (moduleId) {
            const module = Syllabus.getModule(moduleId);
            if (module) {
                moduleName = module.module_name;
                moduleContent = `Module: ${module.module_name}\nTopics: ${module.topics}`;
            }
        }

        // Generate content with AI
        let content;
        const ollamaAvailable = await aiService.isOllamaAvailable();

        if (ollamaAvailable) {
            switch (activityType) {
                case 'mcq':
                    content = await aiService.generateMCQQuiz(moduleContent, moduleName, questionCount || 10, difficulty || 'medium');
                    break;
                case 'crossword':
                    content = await aiService.generateCrossword(moduleContent, moduleName);
                    break;
                case 'fill_blanks':
                    content = await aiService.generateFillBlanks(moduleContent, moduleName, questionCount || 10);
                    break;
                case 'flashcards':
                    content = await aiService.generateFlashcards(moduleContent, moduleName);
                    break;
                default:
                    content = { message: 'Manual content required for this activity type' };
            }
        } else {
            content = {
                message: 'AI not available. Please add content manually.',
                placeholder: true
            };
        }

        // Create activity
        const activity = GeneratedActivity.create({
            syllabusId,
            moduleId,
            facultyId: req.user.id,
            title: title || `${activityType.toUpperCase()}: ${moduleName}`,
            activityType,
            content,
            difficulty: difficulty || 'medium',
            maxScore: activityType === 'mcq' ? (questionCount || 10) * 10 : 100
        });

        res.json({
            activity,
            aiGenerated: ollamaAvailable
        });
    } catch (error) {
        console.error('Generate activity error:', error);
        res.status(500).json({ message: 'Failed to generate activity' });
    }
});

// Get faculty's generated activities
router.get('/activities/generated', auth, (req, res) => {
    try {
        const activities = GeneratedActivity.getAll(req.user.id);
        res.json({ activities });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get activities' });
    }
});

// Update activity content
router.put('/activities/generated/:id', auth, (req, res) => {
    try {
        const { title, content, difficulty, timeLimit, maxScore } = req.body;
        const activity = GeneratedActivity.update(req.params.id, { title, content, difficulty, timeLimit, maxScore });
        res.json({ activity });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update activity' });
    }
});

// Publish activity
router.post('/activities/generated/:id/publish', auth, async (req, res) => {
    try {
        const { studentIds, dueDate, sendEmail = true } = req.body;

        const activity = GeneratedActivity.publish(req.params.id);
        let emailResults = [];

        // Assign to students if provided
        if (studentIds && studentIds.length > 0) {
            GeneratedActivity.assignToMultipleStudents(req.params.id, studentIds, dueDate);

            // Create in-app notifications
            Notification.notifyStudentsOfActivity(
                req.params.id,
                studentIds,
                activity.title,
                req.user.name
            );

            // Send email notifications if enabled
            if (sendEmail) {
                const { sendBulkActivityNotifications } = require('../utils/email');
                const students = studentIds.map(id => Student.getById(id)).filter(s => s && s.email);
                emailResults = await sendBulkActivityNotifications(students, activity, dueDate);
            }
        }

        res.json({
            activity,
            assignedCount: studentIds?.length || 0,
            emailsSent: emailResults.filter(r => r.success).length
        });
    } catch (error) {
        console.error('Publish activity error:', error);
        res.status(500).json({ message: 'Failed to publish activity' });
    }
});

// Delete generated activity
router.delete('/activities/generated/:id', auth, (req, res) => {
    try {
        GeneratedActivity.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete activity' });
    }
});

// ==================== MARKS UPLOAD ROUTES ====================

// Upload ISC marks (faculty)
router.post('/marks/upload', auth, upload.single('file'), async (req, res) => {
    try {
        const { semester, academicYear, year } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'File required' });
        }

        // Read and parse file
        let parsedData = [];
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext === '.csv') {
            const content = fs.readFileSync(req.file.path, 'utf-8');
            parsedData = parseCSVMarks(content);
        }

        // Create marks upload record
        const marksUpload = SemesterMarks.create({
            departmentId: req.user.departmentId,
            uploadedBy: req.user.id,
            semester: parseInt(semester) || 1,
            academicYear: academicYear || '2025-26',
            year: parseInt(year) || 1,
            fileName: req.file.originalname,
            parsedData,
            uploadType: 'isc'
        });

        // Save individual student marks and create students if needed
        for (const row of parsedData) {
            let student = Student.getByRollNumber(row.rollNumber, req.user.departmentId);
            if (!student) {
                student = Student.create({
                    name: row.name,
                    rollNumber: row.rollNumber,
                    email: row.email || `${row.rollNumber}@student.fcrit.ac.in`,
                    departmentId: req.user.departmentId,
                    semester: parseInt(semester) || 1
                });
            }

            SemesterMarks.saveStudentMark({
                marksUploadId: marksUpload.id,
                studentId: student.id,
                subject: row.subject || 'ISC',
                marksObtained: parseFloat(row.marks),
                maxMarks: parseFloat(row.maxMarks) || 100
            });
        }

        // Generate AI suggestions
        const studentMarks = SemesterMarks.getStudentMarks(marksUpload.id);
        const suggestions = await aiService.analyzeMarksForSuggestions(studentMarks);

        // Save suggestions
        for (const s of suggestions) {
            AISuggestion.create({
                marksUploadId: marksUpload.id,
                ...s
            });
        }

        res.json({
            marksUpload,
            studentCount: parsedData.length,
            suggestionsGenerated: suggestions.length
        });
    } catch (error) {
        console.error('Upload marks error:', error);
        res.status(500).json({ message: 'Failed to upload marks' });
    }
});

// Get AI suggestions for faculty
router.get('/ai-suggestions', auth, (req, res) => {
    try {
        const suggestions = AISuggestion.getPending(req.user.departmentId);
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get suggestions' });
    }
});

// Apply AI suggestion (add student to classification)
router.post('/ai-suggestions/:id/apply', auth, (req, res) => {
    try {
        const suggestion = AISuggestion.getById(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ message: 'Suggestion not found' });
        }

        // Create classification
        Classification.create({
            studentId: suggestion.student_id,
            facultyId: req.user.id,
            category: suggestion.suggested_category,
            reason: suggestion.reason,
            academicYear: suggestion.academic_year,
            semester: suggestion.semester,
            source: 'ai_suggested'
        });

        // Mark as applied
        AISuggestion.apply(req.params.id, req.user.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Apply suggestion error:', error);
        res.status(500).json({ message: 'Failed to apply suggestion' });
    }
});

// Dismiss suggestion
router.delete('/ai-suggestions/:id', auth, (req, res) => {
    try {
        AISuggestion.dismiss(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Failed to dismiss suggestion' });
    }
});

// Helper: Parse CSV marks
function parseCSVMarks(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};

        headers.forEach((header, index) => {
            if (header.includes('roll') || header.includes('number')) {
                row.rollNumber = values[index];
            } else if (header.includes('name') && !header.includes('subject')) {
                row.name = values[index];
            } else if (header.includes('email')) {
                row.email = values[index];
            } else if (header.includes('mark') || header.includes('score')) {
                row.marks = values[index];
            } else if (header.includes('max') || header.includes('total')) {
                row.maxMarks = values[index];
            } else if (header.includes('subject')) {
                row.subject = values[index];
            }
        });

        if (row.rollNumber && row.marks) {
            results.push(row);
        }
    }

    return results;
}

module.exports = router;
