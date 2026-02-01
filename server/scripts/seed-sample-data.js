// Sample Data Seed Script for SASTS v2
// Run with: node scripts/seed-sample-data.js

require('dotenv').config();
const { initDatabase, getDb, runQuery, getOne, getAll, saveDatabase } = require('../config/database');
const bcrypt = require('bcryptjs');

const sampleData = {
    // Faculty members for different departments
    faculty: [
        { name: 'Dr. Priya Sharma', email: 'priya.sharma@fcrit.ac.in', department_id: 1, password: 'Faculty@123' },
        { name: 'Prof. Rajesh Kumar', email: 'rajesh.kumar@fcrit.ac.in', department_id: 1, password: 'Faculty@123' },
        { name: 'Dr. Anjali Patil', email: 'anjali.patil@fcrit.ac.in', department_id: 2, password: 'Faculty@123' },
        { name: 'Prof. Vikram Singh', email: 'vikram.singh@fcrit.ac.in', department_id: 3, password: 'Faculty@123' },
    ],

    // Sample students
    students: [
        { name: 'Aarav Patel', roll_number: 'CS2024001', email: 'aarav.patel@student.fcrit.ac.in', semester: 5, department_id: 1 },
        { name: 'Diya Mehta', roll_number: 'CS2024002', email: 'diya.mehta@student.fcrit.ac.in', semester: 5, department_id: 1 },
        { name: 'Arjun Sharma', roll_number: 'CS2024003', email: 'arjun.sharma@student.fcrit.ac.in', semester: 5, department_id: 1 },
        { name: 'Ananya Reddy', roll_number: 'CS2024004', email: 'ananya.reddy@student.fcrit.ac.in', semester: 5, department_id: 1 },
        { name: 'Kabir Gupta', roll_number: 'CS2024005', email: 'kabir.gupta@student.fcrit.ac.in', semester: 5, department_id: 1 },
        { name: 'Ishaan Verma', roll_number: 'IT2024001', email: 'ishaan.verma@student.fcrit.ac.in', semester: 5, department_id: 2 },
        { name: 'Priya Joshi', roll_number: 'IT2024002', email: 'priya.joshi@student.fcrit.ac.in', semester: 5, department_id: 2 },
        { name: 'Rohan Desai', roll_number: 'EC2024001', email: 'rohan.desai@student.fcrit.ac.in', semester: 5, department_id: 3 },
    ],

    // Sample syllabi
    syllabi: [
        {
            subject_name: 'Data Structures and Algorithms',
            subject_code: 'CS301',
            semester: 5,
            modules: [
                { name: 'Arrays and Linked Lists', topics: 'Arrays, Single Linked Lists, Double Linked Lists, Circular Lists', hours: 8 },
                { name: 'Stacks and Queues', topics: 'Stack operations, Queue operations, Priority Queues, Applications', hours: 6 },
                { name: 'Trees and Graphs', topics: 'Binary Trees, BST, AVL Trees, Graph Traversals', hours: 12 },
                { name: 'Sorting and Searching', topics: 'Bubble Sort, Quick Sort, Merge Sort, Binary Search, Hashing', hours: 8 },
            ]
        },
        {
            subject_name: 'Database Management Systems',
            subject_code: 'CS302',
            semester: 5,
            modules: [
                { name: 'Introduction to DBMS', topics: 'Database concepts, DBMS architecture, ER model', hours: 6 },
                { name: 'Relational Model', topics: 'Relational algebra, SQL queries, Normalization', hours: 10 },
                { name: 'Transaction Management', topics: 'ACID properties, Concurrency control, Recovery', hours: 8 },
            ]
        }
    ],

    // Sample generated activities
    activities: [
        {
            title: 'Arrays and Memory Allocation Quiz',
            activity_type: 'mcq',
            topic: 'Arrays and Linked Lists',
            difficulty: 'medium',
            content: JSON.stringify({
                questions: [
                    { question: 'What is the time complexity of accessing an element in an array by index?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correct: 0 },
                    { question: 'Which data structure uses LIFO principle?', options: ['Queue', 'Stack', 'Array', 'Linked List'], correct: 1 },
                    { question: 'What is the space complexity of a singly linked list with n nodes?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correct: 1 },
                ]
            })
        },
        {
            title: 'SQL Fundamentals Crossword',
            activity_type: 'crossword',
            topic: 'Relational Model',
            difficulty: 'easy',
            content: JSON.stringify({
                clues: {
                    across: [{ number: 1, clue: 'Retrieves data from a database', answer: 'SELECT' }],
                    down: [{ number: 2, clue: 'Removes data from a table', answer: 'DELETE' }]
                }
            })
        },
        {
            title: 'Data Structure Concepts - Fill in the Blanks',
            activity_type: 'fill_blanks',
            topic: 'Trees and Graphs',
            difficulty: 'medium',
            content: JSON.stringify({
                sentences: [
                    { text: 'A binary tree where the left child is less than parent is called a ___', answer: 'Binary Search Tree' },
                    { text: 'Graph traversal that visits level by level is called ___', answer: 'BFS' },
                ]
            })
        },
        {
            title: 'Sorting Algorithm Flashcards',
            activity_type: 'flashcards',
            topic: 'Sorting and Searching',
            difficulty: 'easy',
            content: JSON.stringify({
                cards: [
                    { front: 'Quick Sort Average Time Complexity', back: 'O(n log n)' },
                    { front: 'Merge Sort Space Complexity', back: 'O(n)' },
                    { front: 'Bubble Sort Worst Case', back: 'O(n²)' },
                ]
            })
        }
    ]
};

async function seedData() {
    console.log('🌱 Starting sample data seed...\n');

    await initDatabase();
    const db = getDb();

    try {
        // 1. Insert faculty members
        console.log('👩‍🏫 Creating faculty accounts...');

        for (const faculty of sampleData.faculty) {
            const existing = getOne('SELECT id FROM users WHERE email = ?', [faculty.email]);
            if (!existing) {
                const hashedPassword = bcrypt.hashSync(faculty.password, 10);
                runQuery(
                    'INSERT INTO users (name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                    [faculty.name, faculty.email, hashedPassword, 'faculty', faculty.department_id, 1]
                );
                console.log(`   ✓ ${faculty.name} (${faculty.email})`);
            } else {
                console.log(`   - ${faculty.name} already exists`);
            }
        }

        // 2. Insert students
        console.log('\n👨‍🎓 Creating student records...');

        for (const student of sampleData.students) {
            let studentId;
            const existing = getOne('SELECT id FROM students WHERE roll_number = ?', [student.roll_number]);
            if (!existing) {
                const result = runQuery(
                    'INSERT INTO students (name, roll_number, email, semester, department_id) VALUES (?, ?, ?, ?, ?)',
                    [student.name, student.roll_number, student.email, student.semester, student.department_id]
                );
                studentId = result.lastInsertRowid;
                console.log(`   ✓ ${student.name} (${student.roll_number})`);
            } else {
                studentId = existing.id;
                console.log(`   - ${student.name} already exists`);
            }

            // Create student auth if not exists
            if (studentId) {
                const authExists = getOne('SELECT id FROM students_auth WHERE student_id = ? OR email = ?', [studentId, student.email]);
                if (!authExists) {
                    const passwordHash = bcrypt.hashSync('Student@123', 10);
                    runQuery(
                        'INSERT INTO students_auth (student_id, email, password_hash, is_active) VALUES (?, ?, ?, ?)',
                        [studentId, student.email, passwordHash, 1]
                    );
                }
            }
        }

        // 3. Create student classifications
        console.log('\n📊 Creating student classifications...');
        const students = getAll('SELECT id, name, department_id FROM students');
        const faculty = getAll("SELECT id, department_id FROM users WHERE role = 'faculty'");
        const currentYear = new Date().getFullYear();

        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const facultyMember = faculty.find(f => f.department_id === student.department_id) || faculty[0];
            if (!facultyMember) continue;

            const existing = getOne(
                'SELECT id FROM student_classifications WHERE student_id = ? AND faculty_id = ?',
                [student.id, facultyMember.id]
            );
            if (!existing) {
                const category = i % 3 === 0 ? 'weak' : 'strong';
                const reason = category === 'weak' ? 'Below 40% in ISC-1' : 'Above 75% in all assessments';
                runQuery(
                    'INSERT INTO student_classifications (student_id, faculty_id, category, reason, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?)',
                    [student.id, facultyMember.id, category, reason, 5, `${currentYear}-${currentYear + 1}`]
                );
                console.log(`   ✓ ${student.name}: ${category}`);
            }
        }

        // 4. Create syllabi and modules
        console.log('\n📚 Creating syllabi...');
        const facultyCs = faculty.find(f => f.department_id === 1) || faculty[0];

        if (facultyCs) {
            for (const syllabus of sampleData.syllabi) {
                const existing = getOne('SELECT id FROM syllabi WHERE course_code = ?', [syllabus.subject_code]);
                if (!existing) {
                    const result = runQuery(
                        'INSERT INTO syllabi (faculty_id, department_id, course_name, course_code) VALUES (?, ?, ?, ?)',
                        [facultyCs.id, 1, syllabus.subject_name, syllabus.subject_code]
                    );
                    const syllabusId = result.lastInsertRowid;
                    console.log(`   ✓ ${syllabus.subject_name}`);

                    syllabus.modules.forEach((mod, idx) => {
                        runQuery(
                            'INSERT INTO syllabus_modules (syllabus_id, module_number, module_name, topics, hours) VALUES (?, ?, ?, ?, ?)',
                            [syllabusId, idx + 1, mod.name, mod.topics, mod.hours]
                        );
                    });
                }
            }
        }

        // 5. Create generated activities
        console.log('\n🎮 Creating AI-generated activities...');
        const syllabusRecord = getOne('SELECT id FROM syllabi LIMIT 1');

        if (facultyCs && syllabusRecord) {
            for (const activity of sampleData.activities) {
                const existing = getOne('SELECT id FROM generated_activities WHERE title = ?', [activity.title]);
                if (!existing) {
                    runQuery(
                        'INSERT INTO generated_activities (faculty_id, syllabus_id, title, activity_type, content, difficulty, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [facultyCs.id, syllabusRecord.id, activity.title, activity.activity_type, activity.content, activity.difficulty, 1]
                    );
                    console.log(`   ✓ ${activity.title} (${activity.activity_type})`);
                }
            }
        }

        // 6. Create activity assignments
        console.log('\n📋 Creating activity assignments...');
        const allActivities = getAll('SELECT id, title FROM generated_activities');
        const allStudents = getAll('SELECT id FROM students LIMIT 5');

        for (const activity of allActivities) {
            for (const student of allStudents) {
                const existing = getOne(
                    'SELECT id FROM activity_assignments WHERE activity_id = ? AND student_id = ?',
                    [activity.id, student.id]
                );
                if (!existing) {
                    runQuery(
                        'INSERT INTO activity_assignments (activity_id, student_id, due_date) VALUES (?, ?, datetime("now", "+7 days"))',
                        [activity.id, student.id]
                    );
                }
            }
        }
        console.log(`   ✓ Assigned ${allActivities.length} activities to ${allStudents.length} students`);

        // 7. Create sample sessions
        console.log('\n📈 Creating sample activity sessions...');
        const assignments = getAll('SELECT id, activity_id, student_id FROM activity_assignments LIMIT 10');

        let sessionsCreated = 0;
        for (const assignment of assignments) {
            const existing = getOne(
                'SELECT id FROM student_activity_sessions WHERE activity_id = ? AND student_id = ?',
                [assignment.activity_id, assignment.student_id]
            );
            if (!existing) {
                const timeSpent = 300 + Math.floor(Math.random() * 600);
                const score = 60 + Math.floor(Math.random() * 40);
                runQuery(
                    'INSERT INTO student_activity_sessions (student_id, activity_id, started_at, ended_at, time_spent, score, max_score, completed) VALUES (?, ?, datetime("now", "-1 hour"), datetime("now"), ?, ?, 100, 1)',
                    [assignment.student_id, assignment.activity_id, timeSpent, score]
                );
                sessionsCreated++;
            }
        }
        console.log(`   ✓ Created ${sessionsCreated} sample session records`);

        // 8. Create notifications
        console.log('\n🔔 Creating notifications...');
        const studentsForNotif = getAll('SELECT id, name FROM students LIMIT 5');
        for (const student of studentsForNotif) {
            const existing = getOne('SELECT id FROM notifications WHERE recipient_id = ? AND recipient_type = ?', [student.id, 'student']);
            if (!existing) {
                runQuery(
                    'INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type) VALUES (?, ?, ?, ?, ?)',
                    ['student', student.id, 'New Activity Available', 'Arrays and Memory Allocation Quiz is now available.', 'activity']
                );
                runQuery(
                    'INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type) VALUES (?, ?, ?, ?, ?)',
                    ['student', student.id, 'Welcome to SASTS', 'Your account has been set up. Complete your profile!', 'info']
                );
            }
        }
        console.log(`   ✓ Created sample notifications`);

        saveDatabase();

        console.log('\n✅ Sample data seeded successfully!\n');
        console.log('📋 Summary:');
        console.log(`   - Faculty accounts: ${sampleData.faculty.length}`);
        console.log(`   - Student records: ${sampleData.students.length}`);
        console.log(`   - Syllabi: ${sampleData.syllabi.length}`);
        console.log(`   - AI Activities: ${sampleData.activities.length}`);
        console.log('\n🔑 Login Credentials:');
        console.log('   Super Admin: principal@fcrit.ac.in / Principal@2026');
        console.log('   Faculty: priya.sharma@fcrit.ac.in / Faculty@123');
        console.log('   Student: aarav.patel@student.fcrit.ac.in / Student@123\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

seedData();
