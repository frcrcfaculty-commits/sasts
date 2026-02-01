const PDFDocument = require('pdfkit');

const COLORS = {
    primary: '#667eea',
    secondary: '#764ba2',
    weak: '#ef4444',
    strong: '#22c55e',
    text: '#1f2937',
    muted: '#6b7280'
};

// Helper to add header to each page
const addHeader = (doc, title, subtitle) => {
    doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
    doc.fillColor('white')
        .fontSize(20)
        .text(title, 40, 25, { width: doc.page.width - 80 });
    doc.fontSize(10)
        .text(subtitle, 40, 50, { width: doc.page.width - 80 });
    doc.fillColor(COLORS.text);
    doc.moveDown(4);
};

// Generate Faculty Report
const generateFacultyReport = (faculty, classifications, activities) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            addHeader(doc, `Faculty Activity Report`, `${faculty.name} | ${faculty.department_name || 'All Departments'}`);

            // Summary Stats
            doc.fontSize(14).text('Summary', { underline: true });
            doc.moveDown(0.5);

            const weakCount = classifications.filter(c => c.category === 'weak').length;
            const strongCount = classifications.filter(c => c.category === 'strong').length;
            const completedActivities = activities.filter(a => a.completion_status === 'completed').length;

            doc.fontSize(11);
            doc.fillColor(COLORS.weak).text(`Weak Students: ${weakCount}`, { continued: true });
            doc.fillColor(COLORS.text).text('   |   ', { continued: true });
            doc.fillColor(COLORS.strong).text(`Strong Students: ${strongCount}`);
            doc.fillColor(COLORS.text);
            doc.text(`Total Activities: ${activities.length} (${completedActivities} completed)`);
            doc.moveDown(1.5);

            // Weak Students Section
            if (weakCount > 0) {
                doc.fontSize(12).fillColor(COLORS.weak).text('Weak Students', { underline: true });
                doc.fillColor(COLORS.text).fontSize(10);
                doc.moveDown(0.5);

                classifications.filter(c => c.category === 'weak').forEach((c, i) => {
                    doc.text(`${i + 1}. ${c.student_name} (${c.roll_number})`);
                    doc.fillColor(COLORS.muted).text(`   Reason: ${c.reason}`, { indent: 20 });
                    doc.fillColor(COLORS.text);

                    const studentActivities = activities.filter(a => a.classification_id === c.id);
                    if (studentActivities.length > 0) {
                        studentActivities.forEach(a => {
                            doc.text(`   • ${a.title} [${a.completion_status}]`, { indent: 20 });
                        });
                    }
                    doc.moveDown(0.5);
                });
                doc.moveDown(1);
            }

            // Strong Students Section
            if (strongCount > 0) {
                doc.fontSize(12).fillColor(COLORS.strong).text('Strong Students', { underline: true });
                doc.fillColor(COLORS.text).fontSize(10);
                doc.moveDown(0.5);

                classifications.filter(c => c.category === 'strong').forEach((c, i) => {
                    doc.text(`${i + 1}. ${c.student_name} (${c.roll_number})`);
                    doc.fillColor(COLORS.muted).text(`   Reason: ${c.reason}`, { indent: 20 });
                    doc.fillColor(COLORS.text);

                    const studentActivities = activities.filter(a => a.classification_id === c.id);
                    if (studentActivities.length > 0) {
                        studentActivities.forEach(a => {
                            doc.text(`   • ${a.title} [${a.completion_status}]`, { indent: 20 });
                        });
                    }
                    doc.moveDown(0.5);
                });
            }

            // Footer
            doc.fontSize(8)
                .fillColor(COLORS.muted)
                .text(`Generated on ${new Date().toLocaleString()}`, 40, doc.page.height - 40);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// Generate Department Report
const generateDepartmentReport = (department, classifications, activities, reviews, type = 'all') => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Filter by type
            let filteredClassifications = classifications;
            if (type === 'weak') {
                filteredClassifications = classifications.filter(c => c.category === 'weak');
            } else if (type === 'strong') {
                filteredClassifications = classifications.filter(c => c.category === 'strong');
            }

            // Header
            const typeLabel = type === 'all' ? 'Complete' : type.charAt(0).toUpperCase() + type.slice(1) + ' Students';
            addHeader(doc, `Department Report: ${department.name}`, `${typeLabel} Report`);

            // Summary
            doc.fontSize(14).text('Summary Statistics', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11);
            doc.text(`Total Classifications: ${filteredClassifications.length}`);
            doc.text(`Total Activities: ${activities.length}`);
            doc.text(`Completed Activities: ${activities.filter(a => a.completion_status === 'completed').length}`);
            doc.text(`Total Reviews: ${reviews.length}`);

            if (reviews.length > 0) {
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                doc.text(`Average Rating: ${avgRating.toFixed(1)}/5`);
            }
            doc.moveDown(1.5);

            // Faculty breakdown
            const facultyGroups = {};
            filteredClassifications.forEach(c => {
                if (!facultyGroups[c.faculty_name]) {
                    facultyGroups[c.faculty_name] = [];
                }
                facultyGroups[c.faculty_name].push(c);
            });

            Object.entries(facultyGroups).forEach(([facultyName, classifs]) => {
                doc.fontSize(12).text(`Faculty: ${facultyName}`, { underline: true });
                doc.fontSize(10);
                doc.moveDown(0.5);

                classifs.forEach((c, i) => {
                    const color = c.category === 'weak' ? COLORS.weak : COLORS.strong;
                    doc.fillColor(color).text(`[${c.category.toUpperCase()}] `, { continued: true });
                    doc.fillColor(COLORS.text).text(`${c.student_name} (${c.roll_number})`);

                    const studentActivities = activities.filter(a => a.classification_id === c.id);
                    doc.fillColor(COLORS.muted);
                    doc.text(`   Activities: ${studentActivities.length} | Completed: ${studentActivities.filter(a => a.completion_status === 'completed').length}`, { indent: 20 });
                    doc.fillColor(COLORS.text);
                });
                doc.moveDown(1);
            });

            // Footer
            doc.fontSize(8)
                .fillColor(COLORS.muted)
                .text(`Generated on ${new Date().toLocaleString()}`, 40, doc.page.height - 40);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// Generate College-Wide Report
const generateCollegeReport = (departments, stats) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            addHeader(doc, 'College-Wide Academic Support Report', 'Father Agnel Engineering College');

            // Overall Summary
            doc.fontSize(14).text('Overall Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11);
            doc.text(`Total Departments: ${stats.totalDepartments}`);
            doc.text(`Total Faculty: ${stats.totalFaculty}`);
            doc.text(`Total Students Classified: ${stats.totalStudents}`);
            doc.fillColor(COLORS.weak).text(`Weak Students: ${stats.totalWeak}`, { continued: true });
            doc.fillColor(COLORS.text).text('   |   ', { continued: true });
            doc.fillColor(COLORS.strong).text(`Strong Students: ${stats.totalStrong}`);
            doc.fillColor(COLORS.text);
            doc.moveDown(1.5);

            // Department-wise breakdown
            doc.fontSize(14).text('Department-wise Breakdown', { underline: true });
            doc.moveDown(0.5);

            departments.forEach(dept => {
                doc.fontSize(12).text(dept.name, { underline: true });
                doc.fontSize(10);
                if (dept.stats) {
                    doc.text(`   Faculty: ${dept.stats.faculty_count || 0}`);
                    doc.text(`   Students: ${dept.stats.student_count || 0}`);
                    doc.text(`   Weak: ${dept.stats.weak_count || 0} | Strong: ${dept.stats.strong_count || 0}`);
                }
                doc.moveDown(0.5);
            });

            // Footer
            doc.fontSize(8)
                .fillColor(COLORS.muted)
                .text(`Generated on ${new Date().toLocaleString()}`, 40, doc.page.height - 40);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateFacultyReport, generateDepartmentReport, generateCollegeReport };
