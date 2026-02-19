// Enhanced Sample Data Seed Script for SASTS v2
// Run with: node scripts/seed-enhanced-data.js

require('dotenv').config();
const { initDatabase, getDb, runQuery, getOne, getAll, saveDatabase } = require('../config/database');
const bcrypt = require('bcryptjs');

const sampleData = {
    // Enhanced students - 10 weak + 10 strong
    students: [
        // 10 WEAK students
        { name: 'Rahul Patil', roll_number: 'CS2024W01', email: 'rahul.patil@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 35 },
        { name: 'Sneha Deshmukh', roll_number: 'CS2024W02', email: 'sneha.deshmukh@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 28 },
        { name: 'Amit Kulkarni', roll_number: 'CS2024W03', email: 'amit.kulkarni@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 32 },
        { name: 'Pooja Jadhav', roll_number: 'CS2024W04', email: 'pooja.jadhav@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 38 },
        { name: 'Karan Shinde', roll_number: 'CS2024W05', email: 'karan.shinde@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 30 },
        { name: 'Priya Gaikwad', roll_number: 'CS2024W06', email: 'priya.gaikwad@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 25 },
        { name: 'Vikas More', roll_number: 'CS2024W07', email: 'vikas.more@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 33 },
        { name: 'Anjali Pawar', roll_number: 'CS2024W08', email: 'anjali.pawar@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 29 },
        { name: 'Sachin Bhosale', roll_number: 'CS2024W09', email: 'sachin.bhosale@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 36 },
        { name: 'Riya Chavan', roll_number: 'CS2024W10', email: 'riya.chavan@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'weak', marks: 31 },

        // 10 STRONG students
        { name: 'Aditya Sharma', roll_number: 'CS2024S01', email: 'aditya.sharma@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 92 },
        { name: 'Kavya Mehta', roll_number: 'CS2024S02', email: 'kavya.mehta@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 88 },
        { name: 'Rohan Iyer', roll_number: 'CS2024S03', email: 'rohan.iyer@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 85 },
        { name: 'Nisha Verma', roll_number: 'CS2024S04', email: 'nisha.verma@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 90 },
        { name: 'Dev Patel', roll_number: 'CS2024S05', email: 'dev.patel@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 87 },
        { name: 'Simran Kaur', roll_number: 'CS2024S06', email: 'simran.kaur@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 93 },
        { name: 'Aryan Gupta', roll_number: 'CS2024S07', email: 'aryan.gupta@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 86 },
        { name: 'Meera Reddy', roll_number: 'CS2024S08', email: 'meera.reddy@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 91 },
        { name: 'Varun Nair', roll_number: 'CS2024S09', email: 'varun.nair@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 89 },
        { name: 'Tanvi Joshi', roll_number: 'CS2024S10', email: 'tanvi.joshi@student.fcrit.ac.in', semester: 5, department_id: 1, category: 'strong', marks: 94 },
    ],

    // Sample syllabus with book references
    syllabus: {
        subject_name: 'Object Oriented Programming with Java',
        subject_code: 'CS303',
        semester: 5,
        books: [
            { title: 'Java: The Complete Reference', author: 'Herbert Schildt', publisher: 'McGraw-Hill', edition: '12th Edition', type: 'textbook' },
            { title: 'Head First Java', author: 'Kathy Sierra & Bert Bates', publisher: "O'Reilly Media", edition: '3rd Edition', type: 'reference' },
        ],
        modules: [
            { name: 'Introduction to Java', topics: 'History of Java, JDK & JVM, Data Types, Variables, Operators, Control Statements', hours: 6 },
            { name: 'Classes and Objects', topics: 'Class fundamentals, Objects, Constructors, this keyword, Garbage Collection, Methods', hours: 8 },
            { name: 'Inheritance and Polymorphism', topics: 'Inheritance basics, super keyword, Method overriding, Abstract classes, Interfaces', hours: 10 },
            { name: 'Exception Handling', topics: 'Exception types, try-catch-finally, throw and throws, Custom exceptions', hours: 6 },
            { name: 'Multithreading', topics: 'Thread class, Runnable interface, Thread synchronization, Inter-thread communication', hours: 8 },
            { name: 'Collections Framework', topics: 'List, Set, Map interfaces, ArrayList, HashMap, Iterator, Generics', hours: 10 },
        ]
    },

    // Sample activities for new syllabus
    activities: [
        {
            title: 'Java Basics MCQ Quiz',
            activity_type: 'mcq',
            topic: 'Introduction to Java',
            difficulty: 'easy',
            content: JSON.stringify({
                questions: [
                    { question: 'Which company originally developed Java?', options: ['Microsoft', 'Sun Microsystems', 'Apple', 'IBM'], correct: 1 },
                    { question: 'What does JVM stand for?', options: ['Java Virtual Machine', 'Java Variable Method', 'Java Visual Mode', 'Java Version Manager'], correct: 0 },
                    { question: 'Which keyword is used to define a class in Java?', options: ['define', 'struct', 'class', 'object'], correct: 2 },
                    { question: 'What is the extension of Java source files?', options: ['.class', '.java', '.js', '.jvm'], correct: 1 },
                    { question: 'Which is NOT a primitive data type in Java?', options: ['int', 'boolean', 'String', 'char'], correct: 2 },
                ]
            })
        },
        {
            title: 'OOP Concepts Flashcards',
            activity_type: 'flashcards',
            topic: 'Classes and Objects',
            difficulty: 'medium',
            content: JSON.stringify({
                cards: [
                    { front: 'What is Encapsulation?', back: 'Bundling data and methods that operate on that data within a single unit (class), restricting direct access to some components.' },
                    { front: 'What is Inheritance?', back: 'A mechanism where a new class inherits properties and behaviors from an existing class.' },
                    { front: 'What is Polymorphism?', back: 'The ability of objects to take many forms. Method overloading and overriding are examples.' },
                    { front: 'What is Abstraction?', back: 'Hiding complex implementation details and showing only essential features of an object.' },
                    { front: 'What is a Constructor?', back: 'A special method called when an object is created, used to initialize object state.' },
                ]
            })
        },
        {
            title: 'Exception Handling Fill-in-the-Blanks',
            activity_type: 'fill_blanks',
            topic: 'Exception Handling',
            difficulty: 'medium',
            content: JSON.stringify({
                sentences: [
                    { text: 'The ___ block is always executed whether an exception is thrown or not.', answer: 'finally' },
                    { text: 'To throw an exception manually, we use the ___ keyword.', answer: 'throw' },
                    { text: 'All exceptions are subclasses of the ___ class.', answer: 'Throwable' },
                    { text: 'Checked exceptions must be declared using the ___ keyword in method signature.', answer: 'throws' },
                ]
            })
        },
    ]
};

async function seedEnhancedData() {
    console.log('🌱 Starting enhanced sample data seed...\n');

    await initDatabase();
    const db = getDb();

    try {
        // Get or create faculty for CS department
        let faculty = getOne("SELECT id FROM users WHERE role = 'faculty' AND department_id = 1");
        if (!faculty) {
            const hashedPassword = bcrypt.hashSync('Faculty@123', 10);
            const result = runQuery(
                'INSERT INTO users (name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                ['Dr. Sample Faculty', 'sample.faculty@fcrit.ac.in', hashedPassword, 'faculty', 1, 1]
            );
            faculty = { id: Number(result.lastInsertRowid) };
            console.log('👩‍🏫 Created sample faculty account');
        }

        // Insert 20 students (10 weak + 10 strong)
        console.log('\n👨‍🎓 Creating 20 student records (10 weak + 10 strong)...');
        const currentYear = new Date().getFullYear();
        let weakCount = 0, strongCount = 0;

        for (const student of sampleData.students) {
            let studentId;
            const existing = getOne('SELECT id FROM students WHERE roll_number = ?', [student.roll_number]);

            if (!existing) {
                const result = runQuery(
                    'INSERT INTO students (name, roll_number, email, semester, department_id) VALUES (?, ?, ?, ?, ?)',
                    [student.name, student.roll_number, student.email, student.semester, student.department_id]
                );
                studentId = Number(result.lastInsertRowid);
                console.log(`   ✓ ${student.name} (${student.roll_number}) - ${student.category.toUpperCase()}`);
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

                // Create classification
                const classExists = getOne(
                    'SELECT id FROM student_classifications WHERE student_id = ? AND faculty_id = ?',
                    [studentId, faculty.id]
                );
                if (!classExists) {
                    const reason = student.category === 'weak'
                        ? `Scored ${student.marks}% in ISC-1 (below 40% threshold)`
                        : `Scored ${student.marks}% in ISC-1 (above 75% threshold)`;
                    runQuery(
                        'INSERT INTO student_classifications (student_id, faculty_id, category, reason, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?)',
                        [studentId, faculty.id, student.category, reason, 5, `${currentYear}-${currentYear + 1}`]
                    );
                    if (student.category === 'weak') weakCount++;
                    else strongCount++;
                }
            }
        }
        console.log(`   📊 Classified: ${weakCount} weak, ${strongCount} strong`);

        // Create syllabus with books
        console.log('\n📚 Creating sample syllabus with book references...');
        const syllabus = sampleData.syllabus;
        let syllabusId;

        const existingSyllabus = getOne('SELECT id FROM syllabi WHERE course_code = ?', [syllabus.subject_code]);
        if (!existingSyllabus) {
            // Store books as JSON in parsed_content field or create description
            const booksInfo = syllabus.books.map(b => `${b.title} by ${b.author} (${b.publisher}, ${b.edition})`).join('; ');

            const result = runQuery(
                'INSERT INTO syllabi (faculty_id, department_id, course_name, course_code) VALUES (?, ?, ?, ?)',
                [faculty.id, 1, syllabus.subject_name, syllabus.subject_code]
            );
            syllabusId = Number(result.lastInsertRowid);
            console.log(`   ✓ ${syllabus.subject_name} (${syllabus.subject_code})`);
            console.log(`   📖 Books:`);
            syllabus.books.forEach(book => {
                console.log(`      - ${book.title} by ${book.author} (${book.type})`);
            });

            // Create modules
            syllabus.modules.forEach((mod, idx) => {
                runQuery(
                    'INSERT INTO syllabus_modules (syllabus_id, module_number, module_name, topics, hours) VALUES (?, ?, ?, ?, ?)',
                    [syllabusId, idx + 1, mod.name, mod.topics, mod.hours]
                );
            });
            console.log(`   ✓ Created ${syllabus.modules.length} modules`);
        } else {
            syllabusId = existingSyllabus.id;
            console.log(`   - Syllabus already exists`);
        }

        // Create activities
        console.log('\n🎮 Creating sample AI activities...');
        if (syllabusId) {
            for (const activity of sampleData.activities) {
                const existing = getOne('SELECT id FROM generated_activities WHERE title = ?', [activity.title]);
                if (!existing) {
                    runQuery(
                        'INSERT INTO generated_activities (faculty_id, syllabus_id, title, activity_type, content, difficulty, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [faculty.id, syllabusId, activity.title, activity.activity_type, activity.content, activity.difficulty, 1]
                    );
                    console.log(`   ✓ ${activity.title} (${activity.activity_type})`);
                }
            }
        }

        // Assign activities to weak students
        console.log('\n📋 Assigning activities to weak students...');
        const weakStudents = getAll("SELECT s.id, s.name FROM students s INNER JOIN student_classifications sc ON s.id = sc.student_id WHERE sc.category = 'weak'");
        const allActivities = getAll('SELECT id, title FROM generated_activities');

        for (const activity of allActivities) {
            for (const student of weakStudents) {
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
        console.log(`   ✓ Assigned ${allActivities.length} activities to ${weakStudents.length} weak students`);

        // Create notifications for weak students
        console.log('\n🔔 Creating notifications...');
        for (const student of weakStudents) {
            const existing = getOne('SELECT id FROM notifications WHERE recipient_id = ? AND title LIKE ?', [student.id, '%Java%']);
            if (!existing) {
                runQuery(
                    'INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type) VALUES (?, ?, ?, ?, ?)',
                    ['student', student.id, 'New Java Activities Available', 'Complete the assigned Java MCQ Quiz and OOP Flashcards to improve your understanding.', 'activity']
                );
            }
        }
        console.log(`   ✓ Created notifications for weak students`);

        saveDatabase();

        console.log('\n✅ Enhanced sample data seeded successfully!\n');
        console.log('📋 Summary:');
        console.log(`   - Weak students: 10`);
        console.log(`   - Strong students: 10`);
        console.log(`   - Syllabus: ${syllabus.subject_name}`);
        console.log(`   - Books: ${syllabus.books.length}`);
        console.log(`   - Modules: ${syllabus.modules.length}`);
        console.log(`   - Activities: ${sampleData.activities.length}`);
        console.log('\n🔑 Student Login:');
        console.log('   Any student email with password: Student@123');
        console.log('   Example: rahul.patil@student.fcrit.ac.in / Student@123\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

seedEnhancedData();
