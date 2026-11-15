/**
 * Comprehensive End-to-End Integration Test Suite for Jamaran Online Quran Academy
 * Uses Node.js native fetch (Node 18+) & mysql2
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

const API_BASE = 'http://localhost:3000/api';
let dbConnection = null;
let adminToken = null;
let testRegId = null;
let testReviewId = null;
let testStudentId = null;
let testCourseId = null;

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  [PASS] ${testName}`);
    } else {
        console.error(`  [FAIL] ${testName}`);
        throw new Error(`Assertion failed: ${testName}`);
    }
}

async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    let data = null;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = text;
    }

    return {
        status: res.status,
        ok: res.ok,
        data
    };
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('JAMARAN ONLINE QURAN ACADEMY - END-TO-END TEST SUITE');
    console.log('====================================================\n');

    // 1. Direct Database Connection
    console.log('--> Phase 1: Database & Schema Verification');
    dbConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'Jamran_academy'
    });
    assert(dbConnection !== null, 'Connected to MySQL database');

    const [tables] = await dbConnection.execute("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
    const expectedTables = ['admins', 'courses', 'enrollments', 'parent_reviews', 'registrations', 'registration_courses', 'students', 'teachers'];
    expectedTables.forEach(tbl => {
        assert(tableNames.includes(tbl), `Table '${tbl}' exists in schema`);
    });

    // 2. Stats API Verification
    console.log('\n--> Phase 2: Total Enrolled Students Stats API');
    const statsRes = await request('/stats/total-enrolled-students');
    assert(statsRes.status === 200, 'GET /api/stats/total-enrolled-students returns 200 OK');
    assert(statsRes.data.success === true, 'Stats response success is true');
    assert(typeof statsRes.data.total_enrolled === 'number' && statsRes.data.total_enrolled >= 456, `Total enrolled students is >= baseline 456 (Current: ${statsRes.data.total_enrolled})`);
    assert(statsRes.data.baseline === 456, 'Baseline counter is 456');

    // 3. Admin Authentication
    console.log('\n--> Phase 3: Admin Authentication');
    const invalidLogin = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            username: 'admin',
            password: 'WrongPassword123!'
        })
    });
    assert(invalidLogin.status === 401, 'Invalid credentials rejected with 401 Unauthorized');

    const loginRes = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            username: 'admin',
            password: 'Admin@Jamaran2026!'
        })
    });
    assert(loginRes.status === 200, 'Admin login succeeded with 200 OK');
    assert(loginRes.data.token && typeof loginRes.data.token === 'string', 'JWT token issued');
    adminToken = loginRes.data.token;

    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 4. Admin Overview & Authorization
    console.log('\n--> Phase 4: Admin Protected Routes & Overview');
    const overviewRes = await request('/admin/overview', { headers: authHeaders });
    assert(overviewRes.status === 200, 'GET /api/admin/overview returns 200 OK');
    const ovData = overviewRes.data.overview || overviewRes.data.stats;
    assert(ovData && ovData.totalStudents !== undefined, 'Overview contains student metrics');
    assert(ovData.totalReviews !== undefined || ovData.pendingReviews !== undefined, 'Overview contains parent reviews metrics');

    // 5. Registration Flow & Duplicate Prevention
    console.log('\n--> Phase 5: Student Registration Flow & Validation');
    const testEmail = `test_student_${Date.now()}@testacademy.org`;
    const regPayload = {
        name: 'Zainab Fatima',
        email: testEmail,
        country: 'United Kingdom',
        country_code: '+44',
        whatsapp: '7911123456',
        gender: 'Female',
        age: 14,
        teacher_preference: 'Female',
        preferred_timing: 'Evening',
        course: 'duas-ziyarat',
        message: 'Interested in learning Duas with Tajweed.'
    };

    const regRes = await request('/register', {
        method: 'POST',
        body: JSON.stringify(regPayload)
    });
    assert(regRes.status === 201, 'POST /api/register creates new registration with 201 Created');
    assert(regRes.data.success === true, 'Registration response confirmed success');
    testRegId = regRes.data.registration_id;
    assert(testRegId > 0, `Registration ID ${testRegId} returned`);

    // Verify registration was recorded in MySQL
    const [regRows] = await dbConnection.execute(
        `SELECT r.registration_id, r.name, r.status, c.course_name
         FROM registrations r
         JOIN registration_courses rc ON r.registration_id = rc.registration_id
         JOIN courses c ON rc.course_id = c.course_id
         WHERE r.registration_id = ?`,
        [testRegId]
    );
    assert(regRows.length === 1, 'Registration and course link found in database');
    assert(regRows[0].status === 'Pending', 'New registration status is Pending');

    // Verify Duplicate Prevention
    console.log('\n--> Phase 6: Duplicate Registration Rejection');
    const dupRes = await request('/register', {
        method: 'POST',
        body: JSON.stringify(regPayload)
    });
    assert(dupRes.status === 409, 'Duplicate registration rejected with 409 Conflict');

    // 6. Admin Registration Approval & Auto-Enrollment Sync
    console.log('\n--> Phase 7: Registration Approval & Auto-Enrollment');
    const approveRes = await request(`/admin/registrations/${testRegId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'Approved' })
    });
    assert(approveRes.status === 200, 'Registration status updated to Approved');

    // Verify auto-created student and enrollment records
    const [enrollmentRows] = await dbConnection.execute(
        `SELECT e.enrollment_id, e.student_id, e.course_id, s.name, s.email, c.course_name
         FROM enrollments e
         JOIN students s ON e.student_id = s.student_id
         JOIN courses c ON e.course_id = c.course_id
         WHERE s.email = ?`,
        [testEmail]
    );
    assert(enrollmentRows.length === 1, 'Auto-synced student and enrollment created in database');
    testStudentId = enrollmentRows[0].student_id;
    console.log(`  [INFO] Auto-enrolled Student ID: ${testStudentId} into Course: ${enrollmentRows[0].course_name}`);

    // 7. Parent Review Submission (Private by default)
    console.log('\n--> Phase 8: Parent Review System (Private Submission)');
    const reviewPayload = {
        parent_name: 'Dr. Syed Raza',
        parent_email: 'syed.raza@testacademy.org',
        student_name: 'Zainab Fatima',
        parent_phone: '+44 7911 123456',
        course: 'Duas & Ziyaraat',
        rating: 5,
        progress_feedback: 'Zainab has made incredible progress reciting Duas and understanding their spiritual meanings. The teacher is extraordinarily patient!',
        strengths: 'Excellent retention and pronunciation',
        areas_for_improvement: 'Continuing to practice voice projection',
        parent_comments: 'We could not be happier with Jamaran Academy. Highly recommended.',
        consent_to_publish: 1
    };

    const reviewRes = await request('/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewPayload)
    });
    assert(reviewRes.status === 201, 'POST /api/reviews returns 201 Created');
    assert(reviewRes.data.success === true, 'Review submission response confirmed success');
    testReviewId = reviewRes.data.review_id;
    assert(testReviewId > 0, `Review ID ${testReviewId} generated`);

    // Verify review is Pending and private in MySQL
    const [reviewDbRows] = await dbConnection.execute(
        `SELECT review_id, status, consent_to_publish FROM parent_reviews WHERE review_id = ?`,
        [testReviewId]
    );
    assert(reviewDbRows.length === 1, 'Review record exists in parent_reviews table');
    assert(reviewDbRows[0].status === 'Pending', 'New review status is strictly Pending');

    // Verify that Pending review is NOT displayed on public testimonials API
    const publicReviewsBefore = await request('/reviews/public');
    const foundBefore = publicReviewsBefore.data.reviews.find(r => r.id === testReviewId);
    assert(!foundBefore, 'Pending review is NOT exposed on public testimonials API');

    // 8. Admin Moderation of Parent Review
    console.log('\n--> Phase 9: Admin Review Moderation & Public Publication');
    const adminReviewsList = await request('/admin/reviews', { headers: authHeaders });
    assert(adminReviewsList.status === 200, 'GET /api/admin/reviews returns 200 OK');
    const foundInAdmin = adminReviewsList.data.reviews.find(r => r.review_id === testReviewId);
    assert(foundInAdmin !== undefined, 'Admin can view private submitted review');
    assert(foundInAdmin.parent_email === 'syed.raza@testacademy.org', 'Admin sees verified parent contact details');

    // Approve the review
    const approveReviewRes = await request(`/admin/reviews/${testReviewId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'Approved' })
    });
    assert(approveReviewRes.status === 200, 'Admin approved review status to Approved');

    // Verify that Approved review now appears on public testimonials API with SANITIZED data
    const publicReviewsAfter = await request('/reviews/public');
    const foundAfter = publicReviewsAfter.data.reviews.find(r => r.id === testReviewId);
    assert(foundAfter !== undefined, 'Approved review with consent now appears on public testimonials API');
    assert(foundAfter.parent_name === 'Dr. Syed Raza', 'Parent name displays correctly');
    assert(!foundAfter.parent_email, 'Parent email is NOT leaked in public API');
    assert(!foundAfter.parent_phone, 'Parent phone is NOT leaked in public API');
    assert(foundAfter.rating === 5, 'Rating displays correctly (5)');

    // 9. Admin Student CRUD
    console.log('\n--> Phase 10: Admin Student CRUD Operations');
    const newStudentRes = await request('/admin/students', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            name: 'Temporary Test Student',
            email: `temp_student_${Date.now()}@testacademy.org`,
            country: 'Canada',
            country_code: '+1',
            whatsapp: '4165550199',
            gender: 'Male',
            age: 12
        })
    });
    assert(newStudentRes.status === 201, 'POST /api/admin/students creates new student record');
    const createdStudentId = newStudentRes.data.student_id;

    const updateStudentRes = await request(`/admin/students/${createdStudentId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
            name: 'Temporary Test Student Updated',
            country: 'Canada',
            country_code: '+1',
            whatsapp: '4165550199',
            gender: 'Male',
            age: 13
        })
    });
    assert(updateStudentRes.status === 200, 'PUT /api/admin/students/:id updates student record');

    const deleteStudentRes = await request(`/admin/students/${createdStudentId}`, {
        method: 'DELETE',
        headers: authHeaders
    });
    assert(deleteStudentRes.status === 200, 'DELETE /api/admin/students/:id removes student record');

    // 10. Admin Course CRUD
    console.log('\n--> Phase 11: Admin Course CRUD Operations');
    const newCourseRes = await request('/admin/courses', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            course_name: 'Test Islamic History Course',
            description: 'Comprehensive study of Islamic and Shia history.',
            level: 'Intermediate',
            duration_weeks: 16,
            is_active: 1
        })
    });
    assert(newCourseRes.status === 201, 'POST /api/admin/courses creates new course');
    testCourseId = newCourseRes.data.course_id;

    const deleteCourseRes = await request(`/admin/courses/${testCourseId}`, {
        method: 'DELETE',
        headers: authHeaders
    });
    assert(deleteCourseRes.status === 200, 'DELETE /api/admin/courses/:id deletes course record');

    // 11. Cleanup test records
    console.log('\n--> Phase 12: Database Cleanup of Test Artifacts');
    if (testReviewId) {
        await dbConnection.execute(`DELETE FROM parent_reviews WHERE review_id = ?`, [testReviewId]);
    }
    if (testRegId) {
        await dbConnection.execute(`DELETE FROM registration_courses WHERE registration_id = ?`, [testRegId]);
        await dbConnection.execute(`DELETE FROM registrations WHERE registration_id = ?`, [testRegId]);
    }
    if (testStudentId) {
        await dbConnection.execute(`DELETE FROM enrollments WHERE student_id = ?`, [testStudentId]);
        await dbConnection.execute(`DELETE FROM students WHERE student_id = ?`, [testStudentId]);
    }
    console.log('  [PASS] Test records cleaned up successfully.');

    await dbConnection.end();

    console.log('\n====================================================');
    console.log(`ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! (${passedTests}/${totalTests} Passed)`);
    console.log('====================================================\n');
}

runTestSuite().catch(async (err) => {
    console.error('\n[FATAL TEST FAILURE]:', err.message);
    if (dbConnection) {
        try { await dbConnection.end(); } catch (e) {}
    }
    process.exit(1);
});
