/**
 * SASTS Sample Data Seed Script
 * Creates test data for demonstration purposes
 */

const { runQuery, getAll, getOne } = require('./config/database');
const bcrypt = require('bcryptjs');

async function seedSampleData() {
    console.log('\n🌱 Seeding sample data for SASTS...\n');

    // Get departments
    const departments = getAll('SELECT * FROM departments');
    console.log(`Found ${departments.length} departments`);

    // Create faculty accounts for each department
    const facultyAccounts = [];
    for (const dept of departments) {
        const existingFaculty = getOne('SELECT id FROM users WHERE department_id = ? AND role = ?', [dept.id, 'faculty']);
        if (!existingFaculty) {
            const passwordHash = bcrypt.hashSync('Faculty@2026', 10);
            const result = runQuery(`
        INSERT INTO users (name, email, password_hash, role, department_id)
        VALUES (?, ?, ?, 'faculty', ?)
      `, [
                `${dept.name} Faculty`,
                `faculty.${dept.name.toLowerCase().replace(/\s+/g, '')}@fcrit.ac.in`,
                passwordHash,
                dept.id
            ]);
            facultyAccounts.push({ id: result.lastInsertRowid, deptId: dept.id, deptName: dept.name });
            console.log(`✅ Created faculty for ${dept.name}`);
        }
    }

    // Create sample students per department
    const studentsPerDept = 15;
    for (const dept of departments) {
        const existingStudents = getAll('SELECT id FROM students WHERE department_id = ?', [dept.id]);

        if (existingStudents.length < 5) {
            for (let i = 1; i <= studentsPerDept; i++) {
                const rollNumber = `${dept.name.substring(0, 2).toUpperCase()}${String(i).padStart(3, '0')}`;
                const email = `${rollNumber.toLowerCase()}@student.fcrit.ac.in`;
                const semester = Math.floor(Math.random() * 8) + 1;
                const year = Math.ceil(semester / 2);

                runQuery(`
          INSERT OR IGNORE INTO students (name, email, roll_number, department_id, semester, year)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
                    `Student ${rollNumber}`,
                    email,
                    rollNumber,
                    dept.id,
                    semester,
                    year
                ]);
            }
            console.log(`✅ Created ${studentsPerDept} students for ${dept.name}`);
        }
    }

    // Create student auth accounts for a few students
    const sampleStudents = getAll('SELECT * FROM students LIMIT 10');
    for (const student of sampleStudents) {
        const existing = getOne('SELECT id FROM students_auth WHERE student_id = ?', [student.id]);
        if (!existing) {
            const passwordHash = bcrypt.hashSync('Student@2026', 10);
            runQuery(`
        INSERT INTO students_auth (student_id, email, password_hash)
        VALUES (?, ?, ?)
      `, [student.id, student.email, passwordHash]);
        }
    }
    console.log(`✅ Created ${sampleStudents.length} student login accounts`);

    // Create sample classifications
    const faculty = getOne('SELECT id, department_id FROM users WHERE role = ?', ['faculty']);
    const students = getAll('SELECT * FROM students WHERE department_id = ? LIMIT 12', [faculty?.department_id || 1]);

    let weakCount = 0, strongCount = 0;
    for (let i = 0; i < students.length; i++) {
        const existing = getOne('SELECT id FROM student_classifications WHERE student_id = ?', [students[i].id]);
        if (!existing) {
            const category = i < 6 ? 'weak' : 'strong';
            const reason = category === 'weak'
                ? 'Below average performance in ISC assessments'
                : 'Excellent academic performance and participation';

            runQuery(`
        INSERT INTO student_classifications (student_id, faculty_id, category, reason, academic_year, semester)
        VALUES (?, ?, ?, ?, '2025-26', ?)
      `, [students[i].id, faculty?.id || 1, category, reason, students[i].semester]);

            if (category === 'weak') weakCount++;
            else strongCount++;
        }
    }
    console.log(`✅ Created ${weakCount} weak + ${strongCount} strong classifications`);

    // Create sample syllabus
    const existingSyllabus = getOne('SELECT id FROM syllabi LIMIT 1');
    if (!existingSyllabus && faculty) {
        const syllabusResult = runQuery(`
      INSERT INTO syllabi (faculty_id, department_id, course_name, course_code, file_name, parsed_modules)
      VALUES (?, ?, 'Data Structures', 'CS201', 'ds_syllabus.pdf', ?)
    `, [
            faculty.id,
            faculty.department_id,
            JSON.stringify([
                { number: 1, name: 'Introduction to Data Structures', topics: ['Arrays', 'Pointers', 'Complexity'], hours: 6 },
                { number: 2, name: 'Stacks and Queues', topics: ['Stack operations', 'Queue types', 'Applications'], hours: 8 },
                { number: 3, name: 'Linked Lists', topics: ['Singly linked', 'Doubly linked', 'Circular'], hours: 8 },
                { number: 4, name: 'Trees', topics: ['Binary trees', 'BST', 'AVL', 'Traversals'], hours: 10 },
                { number: 5, name: 'Graphs', topics: ['Representations', 'BFS', 'DFS', 'Shortest paths'], hours: 10 }
            ])
        ]);

        // Add modules
        const modules = [
            { num: 1, name: 'Introduction to Data Structures', topics: ['Arrays', 'Pointers', 'Complexity'] },
            { num: 2, name: 'Stacks and Queues', topics: ['Stack operations', 'Queue types', 'Applications'] },
            { num: 3, name: 'Linked Lists', topics: ['Singly linked', 'Doubly linked', 'Circular'] },
            { num: 4, name: 'Trees', topics: ['Binary trees', 'BST', 'AVL', 'Traversals'] },
            { num: 5, name: 'Graphs', topics: ['Representations', 'BFS', 'DFS', 'Shortest paths'] }
        ];

        for (const mod of modules) {
            runQuery(`
        INSERT INTO syllabus_modules (syllabus_id, module_number, module_name, topics, hours)
        VALUES (?, ?, ?, ?, ?)
      `, [syllabusResult.lastInsertRowid, mod.num, mod.name, JSON.stringify(mod.topics), 8]);
        }
        console.log('✅ Created sample syllabus with 5 modules');

        // Create sample generated activity
        const sampleQuiz = {
            questions: [
                {
                    id: 1,
                    question: 'What is the time complexity of accessing an element in an array by index?',
                    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
                    correct_answer: 0,
                    explanation: 'Array access by index is constant time because memory addresses are calculated directly.'
                },
                {
                    id: 2,
                    question: 'Which data structure follows LIFO (Last In First Out) principle?',
                    options: ['Queue', 'Stack', 'Linked List', 'Tree'],
                    correct_answer: 1,
                    explanation: 'Stack follows LIFO - the last element added is the first to be removed.'
                },
                {
                    id: 3,
                    question: 'In a Binary Search Tree, elements smaller than root are placed in...',
                    options: ['Right subtree', 'Left subtree', 'Either subtree', 'At the root'],
                    correct_answer: 1,
                    explanation: 'BST property: left subtree contains smaller elements, right contains larger.'
                },
                {
                    id: 4,
                    question: 'What traversal of a BST gives elements in sorted order?',
                    options: ['Preorder', 'Postorder', 'Inorder', 'Level order'],
                    correct_answer: 2,
                    explanation: 'Inorder traversal (Left-Root-Right) of BST produces sorted sequence.'
                },
                {
                    id: 5,
                    question: 'Which algorithm is used to find shortest path in an unweighted graph?',
                    options: ['DFS', 'BFS', 'Dijkstra', 'Prim'],
                    correct_answer: 1,
                    explanation: 'BFS finds shortest path in unweighted graphs as it explores level by level.'
                }
            ]
        };

        runQuery(`
      INSERT INTO generated_activities (syllabus_id, module_id, faculty_id, title, activity_type, content, difficulty, max_score, is_published)
      VALUES (?, NULL, ?, 'Data Structures Basics Quiz', 'mcq', ?, 'medium', 50, 1)
    `, [syllabusResult.lastInsertRowid, faculty.id, JSON.stringify(sampleQuiz)]);
        console.log('✅ Created sample MCQ activity with 5 questions');
    }

    // Create sample notifications
    const testStudent = getOne('SELECT sa.id as auth_id, s.id FROM students_auth sa JOIN students s ON sa.student_id = s.id LIMIT 1');
    if (testStudent) {
        runQuery(`
      INSERT INTO notifications (recipient_type, recipient_id, title, message, link, notification_type)
      VALUES ('student', ?, '🎮 Welcome to SASTS!', 'Your student account has been created. Start exploring activities!', '/student-dashboard.html', 'info')
    `, [testStudent.id]);
        console.log('✅ Created sample notifications');
    }

    console.log('\n✨ Sample data seeding complete!\n');
    console.log('📋 Test Credentials:');
    console.log('   Faculty: faculty.<dept>@fcrit.ac.in / Faculty@2026');
    console.log('   Student: <rollnumber>@student.fcrit.ac.in / Student@2026');
    console.log('');
}

// Run if called directly
if (require.main === module) {
    const { initDatabase } = require('./config/database');

    (async () => {
        await initDatabase();
        await seedSampleData();
    })();
}

module.exports = { seedSampleData };
