const express = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const db = require("./db");
const { generateUniqueCourseSlug } = require("./slugHelper");

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

// =====================================
// 1. Verify Admin Token
// =====================================
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token missing. Please log in."
        });
    }

    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        return res.status(500).json({
            success: false,
            message: "JWT_SECRET is not configured correctly on the server."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: "jamaran-academy"
        });

        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin privileges required."
            });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Session expired or invalid token. Please log in again."
        });
    }
}

router.use(verifyAdmin);

// =====================================
// 2. Validate Numeric IDs
// =====================================
function validId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

// =====================================
// 3. Dashboard Overview
// =====================================
router.get("/overview", async (req, res) => {
    try {
        const [students] = await db.execute(
            "SELECT COUNT(*) AS total FROM students"
        );

        const [teachers] = await db.execute(
            "SELECT COUNT(*) AS total FROM teachers WHERE is_active = 1"
        );

        const [courses] = await db.execute(
            "SELECT COUNT(*) AS total FROM courses WHERE is_active = 1"
        );

        const [registrations] = await db.execute(`
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(status = 'Pending'), 0) AS pending,
                COALESCE(SUM(status = 'Approved'), 0) AS approved,
                COALESCE(SUM(status = 'Rejected'), 0) AS rejected
            FROM registrations
        `);

        const [reviews] = await db.execute(`
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(status = 'Pending'), 0) AS pending,
                COALESCE(SUM(status = 'Approved'), 0) AS approved,
                COALESCE(SUM(status = 'Rejected'), 0) AS rejected,
                COALESCE(SUM(is_published = 1), 0) AS published
            FROM parent_reviews
        `);

        const [countries] = await db.execute(`
            SELECT country, COUNT(*) AS total
            FROM students
            GROUP BY country
            ORDER BY total DESC, country ASC
        `);

        const [recent] = await db.execute(`
            SELECT registration_id, name, country, status, created_at
            FROM registrations
            ORDER BY created_at DESC
            LIMIT 5
        `);

        return res.json({
            success: true,
            overview: {
                totalStudents: students[0].total,
                activeTeachers: teachers[0].total,
                activeCourses: courses[0].total,
                totalRegistrations: registrations[0].total,
                pendingRegistrations: registrations[0].pending,
                approvedRegistrations: registrations[0].approved,
                rejectedRegistrations: registrations[0].rejected,
                totalReviews: reviews[0].total,
                pendingReviews: reviews[0].pending,
                approvedReviews: reviews[0].approved,
                publishedReviews: reviews[0].published
            },
            countries,
            recent
        });
    } catch (error) {
        console.error("Overview error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load dashboard overview."
        });
    }
});

// =====================================
// 4. Students Management (CRUD)
// =====================================

// GET /students - List with search and country filter
router.get("/students", async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const country = String(req.query.country || "").trim();

        let sql = `
            SELECT s.student_id, s.name, s.email, s.country, s.country_code,
                   s.whatsapp, s.gender, s.age, s.created_at,
                   GROUP_CONCAT(DISTINCT c.course_name SEPARATOR ', ') AS enrolled_courses
            FROM students s
            LEFT JOIN enrollments e ON s.student_id = e.student_id
            LEFT JOIN courses c ON e.course_id = c.course_id
            WHERE 1 = 1
        `;

        const params = [];

        if (search) {
            sql += ` AND (
                s.name LIKE ? OR s.email LIKE ? OR s.whatsapp LIKE ?
            )`;
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        if (country) {
            sql += " AND s.country = ?";
            params.push(country);
        }

        sql += " GROUP BY s.student_id ORDER BY s.created_at DESC";

        const [rows] = await db.execute(sql, params);

        return res.json({
            success: true,
            students: rows
        });
    } catch (error) {
        console.error("Students list error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load student records."
        });
    }
});

// POST /students - Create new student
router.post("/students", async (req, res) => {
    const { name, email, country, country_code, whatsapp, gender, age, course_ids } = req.body || {};

    const studentName = String(name || "").trim();
    const studentEmail = String(email || "").trim().toLowerCase();
    const studentCountry = String(country || "").trim();
    const studentCode = String(country_code || "+92").trim();
    const studentPhone = String(whatsapp || "").trim();
    const studentGender = String(gender || "").trim();
    const studentAge = Number(age);

    if (studentName.length < 2 || !studentCountry || !studentPhone || !["Male", "Female"].includes(studentGender)) {
        return res.status(400).json({
            success: false,
            message: "Please provide valid student name, country, phone, and gender."
        });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO students (name, email, country, country_code, whatsapp, gender, age)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [studentName, studentEmail || null, studentCountry, studentCode, studentPhone, studentGender, studentAge || 0]
        );

        const studentId = result.insertId;

        // If course_ids provided, enroll student
        if (Array.isArray(course_ids) && course_ids.length > 0) {
            for (const cId of course_ids) {
                if (validId(cId)) {
                    await connection.execute(
                        `INSERT IGNORE INTO enrollments (student_id, course_id, status)
                         VALUES (?, ?, 'Active')`,
                        [studentId, Number(cId)]
                    );
                }
            }
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Student record created successfully.",
            student_id: studentId
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Create student error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not create student record."
        });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /students/:id - Update student
router.put("/students/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    const { name, email, country, country_code, whatsapp, gender, age } = req.body || {};

    const studentName = String(name || "").trim();
    const studentEmail = String(email || "").trim().toLowerCase();
    const studentCountry = String(country || "").trim();
    const studentCode = String(country_code || "+92").trim();
    const studentPhone = String(whatsapp || "").trim();
    const studentGender = String(gender || "").trim();
    const studentAge = Number(age);

    if (studentName.length < 2 || !studentCountry || !studentPhone || !["Male", "Female"].includes(studentGender)) {
        return res.status(400).json({
            success: false,
            message: "Please provide valid student name, country, phone, and gender."
        });
    }

    try {
        const [result] = await db.execute(
            `UPDATE students
             SET name = ?, email = ?, country = ?, country_code = ?, whatsapp = ?, gender = ?, age = ?
             WHERE student_id = ?`,
            [studentName, studentEmail || null, studentCountry, studentCode, studentPhone, studentGender, studentAge || 0, Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Student record not found." });
        }

        return res.json({
            success: true,
            message: "Student record updated successfully."
        });
    } catch (error) {
        console.error("Update student error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update student record."
        });
    }
});

// DELETE /students/:id - Delete student
router.delete("/students/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    try {
        const [result] = await db.execute(
            "DELETE FROM students WHERE student_id = ?",
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Student record not found." });
        }

        return res.json({
            success: true,
            message: "Student record removed successfully."
        });
    } catch (error) {
        console.error("Delete student error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not delete student record."
        });
    }
});

// =====================================
// 5. Registration Requests Management
// =====================================

// GET /registrations - List registrations
router.get("/registrations", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                r.registration_id,
                r.student_id,
                r.name,
                r.email,
                r.country,
                r.country_code,
                r.whatsapp,
                r.gender,
                r.age,
                r.teacher_preference,
                r.preferred_timing,
                r.teacher_id,
                r.message,
                r.status,
                r.created_at,
                r.reviewed_at,
                t.name AS teacher_name,
                GROUP_CONCAT(
                    DISTINCT c.course_name
                    ORDER BY c.course_name
                    SEPARATOR ', '
                ) AS course_names,
                GROUP_CONCAT(
                    DISTINCT c.course_id
                    ORDER BY c.course_id
                    SEPARATOR ','
                ) AS course_ids
            FROM registrations r
            LEFT JOIN teachers t
                ON r.teacher_id = t.teacher_id
            LEFT JOIN registration_courses rc
                ON r.registration_id = rc.registration_id
            LEFT JOIN courses c
                ON rc.course_id = c.course_id
            GROUP BY r.registration_id
            ORDER BY r.created_at DESC
        `);

        return res.json({
            success: true,
            registrations: rows
        });
    } catch (error) {
        console.error("Registrations error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load registrations."
        });
    }
});

// PATCH /registrations/:id/status - Approve / Reject registration
router.patch("/registrations/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, teacher_id } = req.body;

    if (!validId(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid registration ID."
        });
    }

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid registration status."
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        // Fetch registration
        const [registrations] = await connection.execute(
            `SELECT * FROM registrations WHERE registration_id = ? FOR UPDATE`,
            [Number(id)]
        );

        if (registrations.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Registration not found."
            });
        }

        const registration = registrations[0];
        let studentId = registration.student_id || null;

        // Fetch courses for this registration
        const [regCourses] = await connection.execute(
            `SELECT course_id FROM registration_courses WHERE registration_id = ?`,
            [Number(id)]
        );

        if (status === "Approved") {
            // Find existing student by email or phone if student_id is null
            if (!studentId) {
                if (registration.email) {
                    const [matchedByEmail] = await connection.execute(
                        `SELECT student_id FROM students WHERE LOWER(email) = ? LIMIT 1`,
                        [registration.email.toLowerCase()]
                    );
                    if (matchedByEmail.length > 0) {
                        studentId = matchedByEmail[0].student_id;
                    }
                }

                if (!studentId) {
                    const [matchedByPhone] = await connection.execute(
                        `SELECT student_id FROM students WHERE whatsapp = ? AND country_code = ? LIMIT 1`,
                        [registration.whatsapp, registration.country_code]
                    );
                    if (matchedByPhone.length > 0) {
                        studentId = matchedByPhone[0].student_id;
                    }
                }
            }

            // Create student record if still not found
            if (!studentId) {
                const [studentResult] = await connection.execute(
                    `INSERT INTO students (
                        name, email, country, country_code, whatsapp, gender, age
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        registration.name,
                        registration.email || null,
                        registration.country,
                        registration.country_code,
                        registration.whatsapp,
                        registration.gender,
                        registration.age
                    ]
                );

                studentId = studentResult.insertId;
            }

            // Enroll student in all requested courses
            for (const rc of regCourses) {
                await connection.execute(
                    `INSERT INTO enrollments (student_id, course_id, registration_id, status)
                     VALUES (?, ?, ?, 'Active')
                     ON DUPLICATE KEY UPDATE status = 'Active', registration_id = VALUES(registration_id)`,
                    [studentId, rc.course_id, Number(id)]
                );
            }
        }

        // Update registration record
        const assignedTeacherId = validId(teacher_id) ? Number(teacher_id) : (registration.teacher_id || null);

        await connection.execute(
            `UPDATE registrations
             SET status = ?,
                 student_id = ?,
                 teacher_id = ?,
                 reviewed_at = CURRENT_TIMESTAMP
             WHERE registration_id = ?`,
            [status, studentId, assignedTeacherId, Number(id)]
        );

        await connection.commit();
        transactionStarted = false;

        return res.json({
            success: true,
            message: status === "Approved"
                ? "Registration approved and student enrolled successfully."
                : `Registration status updated to ${status}.`,
            registration_id: Number(id),
            student_id: studentId,
            status
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }
        console.error("Status update error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update registration status."
        });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /registrations/:id - Delete registration
router.delete("/registrations/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid registration ID." });
    }

    try {
        const [result] = await db.execute(
            "DELETE FROM registrations WHERE registration_id = ?",
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Registration not found." });
        }

        return res.json({
            success: true,
            message: "Registration deleted successfully."
        });
    } catch (error) {
        console.error("Delete registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not delete registration."
        });
    }
});

// =====================================
// 6. Parent Reviews Management (CRUD)
// =====================================

// GET /reviews - List all parent reviews
router.get("/reviews", async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();

        let sql = `
            SELECT
                r.review_id,
                r.student_id,
                r.student_name,
                r.course_id,
                r.course_name,
                r.parent_name,
                r.relationship,
                r.parent_email,
                r.parent_phone,
                r.review_date,
                r.progress_feedback,
                r.strengths,
                r.areas_for_improvement,
                r.parent_comments,
                r.rating,
                r.consent_to_publish,
                r.is_published,
                r.published_at,
                r.status,
                r.admin_notes,
                r.reviewed_at,
                r.created_at,
                a.username AS reviewer_admin
            FROM parent_reviews r
            LEFT JOIN admins a ON r.reviewed_by = a.admin_id
            WHERE 1 = 1
        `;

        const params = [];

        if (search) {
            sql += ` AND (
                r.student_name LIKE ? OR r.parent_name LIKE ? OR r.parent_email LIKE ? OR r.course_name LIKE ?
            )`;
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        if (status && ["Pending", "Approved", "Rejected"].includes(status)) {
            sql += " AND r.status = ?";
            params.push(status);
        }

        // Filter by publication state (published=1 / unpublished=0)
        if (req.query.published === "1") {
            sql += " AND r.is_published = 1";
        } else if (req.query.published === "0") {
            sql += " AND r.is_published = 0";
        }

        sql += " ORDER BY r.created_at DESC";

        const [rows] = await db.execute(sql, params);

        return res.json({
            success: true,
            reviews: rows
        });
    } catch (error) {
        console.error("Parent reviews error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load parent reviews."
        });
    }
});

// GET /reviews/:id - Get single review
router.get("/reviews/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid review ID." });
    }

    try {
        const [rows] = await db.execute(
            `SELECT * FROM parent_reviews WHERE review_id = ? LIMIT 1`,
            [Number(id)]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.json({
            success: true,
            review: rows[0]
        });
    } catch (error) {
        console.error("Get review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve review."
        });
    }
});

// PATCH /reviews/:id/status - Approve, Reject or Set Pending
router.patch("/reviews/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body || {};

    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid review ID." });
    }

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const adminId = req.admin?.sub ? Number(req.admin.sub) : null;

    try {
        // Attempt an authorised auto-publish:
        //   Approving a review that carries the parent's consent publishes it
        //   immediately (no redeploy needed). Reviews without consent remain
        //   Approved but private. Moving a review away from Approved always
        //   unpublishes it so nothing unauthorised stays on the public site.
        let publishNow = false;

        if (status === "Approved") {
            const [rows] = await db.execute(
                `SELECT consent_to_publish FROM parent_reviews WHERE review_id = ? LIMIT 1`,
                [Number(id)]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "Review not found." });
            }

            publishNow = Boolean(rows[0].consent_to_publish);
        }

        const [result] = await db.execute(
            `UPDATE parent_reviews
             SET status = ?,
                 admin_notes = COALESCE(?, admin_notes),
                 is_published = ?,
                 published_at = ?,
                 reviewed_by = ?,
                 reviewed_at = CURRENT_TIMESTAMP
             WHERE review_id = ?`,
            [
                status,
                admin_notes || null,
                publishNow ? 1 : 0,
                publishNow ? new Date() : null,
                adminId,
                Number(id)
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.json({
            success: true,
            message: status === "Approved"
                ? (publishNow
                    ? "Review approved and published. It is now live on the public website."
                    : "Review approved. The parent did not consent to publish, so it remains private.")
                : `Review marked as ${status}.`,
            status,
            is_published: publishNow ? 1 : 0
        });
    } catch (error) {
        console.error("Update review status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update review status."
        });
    }
});

// =====================================
// PATCH /reviews/:id/publish
// Toggle publication status.
// • publish = true  → sets is_published = 1, published_at = NOW()
//   (only allowed if status = 'Approved' AND consent_to_publish = 1)
// • publish = false → sets is_published = 0, published_at = NULL
// =====================================
router.patch("/reviews/:id/publish", async (req, res) => {
    const { id } = req.params;
    const { publish } = req.body || {};

    if (!validId(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid review ID."
        });
    }

    if (typeof publish !== "boolean" && publish !== 1 && publish !== 0
        && publish !== "true" && publish !== "false") {
        return res.status(400).json({
            success: false,
            message: "Field 'publish' must be a boolean (true or false)."
        });
    }

    const isPublishing = publish === true || publish === 1 || publish === "true";
    const adminId = req.admin?.sub ? Number(req.admin.sub) : null;

    try {
        if (isPublishing) {
            const [rows] = await db.execute(
                `SELECT review_id, status, consent_to_publish
                 FROM parent_reviews WHERE review_id = ? LIMIT 1`,
                [Number(id)]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: "Review not found." });
            }

            const review = rows[0];

            if (review.status !== "Approved") {
                return res.status(409).json({
                    success: false,
                    message: "This review must be Approved before it can be published."
                });
            }

            if (!review.consent_to_publish) {
                return res.status(409).json({
                    success: false,
                    message: "This review cannot be published: the parent has not given consent to publish."
                });
            }
        }

        const [result] = await db.execute(
            `UPDATE parent_reviews
             SET is_published = ?,
                 published_at = ?,
                 reviewed_by  = COALESCE(reviewed_by, ?),
                 reviewed_at  = COALESCE(reviewed_at, CURRENT_TIMESTAMP)
             WHERE review_id = ?`,
            [
                isPublishing ? 1 : 0,
                isPublishing ? new Date() : null,
                adminId,
                Number(id)
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.json({
            success: true,
            message: isPublishing
                ? "Review published successfully. It will now appear on the public website."
                : "Review unpublished. It has been removed from the public website.",
            is_published: isPublishing ? 1 : 0
        });

    } catch (error) {
        console.error("Publish review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update publication status."
        });
    }
});

// PUT /reviews/:id - Edit review details
router.put("/reviews/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid review ID." });
    }

    const {
        progress_feedback, strengths, areas_for_improvement, relationship,
        parent_comments, rating, consent_to_publish, admin_notes, status
    } = req.body || {};

    try {
        // If the admin edits a review's status/consent through this endpoint,
        // keep publication state consistent and authorised:
        //   published  ⇔  status = 'Approved' AND consent_to_publish = 1
        const [existingRows] = await db.execute(
            `SELECT status, consent_to_publish, is_published
             FROM parent_reviews WHERE review_id = ? LIMIT 1`,
            [Number(id)]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        const existing = existingRows[0];
        const nextStatus = status || existing.status;
        const nextConsent = consent_to_publish !== undefined
            ? Number(Boolean(consent_to_publish))
            : Number(existing.consent_to_publish);

        const shouldPublish = nextStatus === "Approved" && nextConsent === 1;

        const [result] = await db.execute(
            `UPDATE parent_reviews
             SET progress_feedback = COALESCE(?, progress_feedback),
                 strengths = ?,
                 areas_for_improvement = ?,
                 relationship = COALESCE(?, relationship),
                 parent_comments = ?,
                 rating = ?,
                 consent_to_publish = ?,
                 admin_notes = ?,
                 status = ?,
                 is_published = ?,
                 published_at = CASE
                     WHEN ? = 1 AND is_published = 1 THEN published_at
                     WHEN ? = 1 THEN ?
                     ELSE NULL
                 END
             WHERE review_id = ?`,
            [
                progress_feedback || null,
                strengths || null,
                areas_for_improvement || null,
                relationship || null,
                parent_comments || null,
                rating !== undefined ? Number(rating) : null,
                nextConsent,
                admin_notes || null,
                nextStatus,
                shouldPublish ? 1 : 0,
                shouldPublish ? 1 : 0,
                shouldPublish ? 1 : 0,
                shouldPublish ? new Date() : null,
                Number(id)
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.json({
            success: true,
            message: "Review updated successfully.",
            is_published: shouldPublish ? 1 : 0
        });
    } catch (error) {
        console.error("Edit review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update review."
        });
    }
});

// DELETE /reviews/:id - Delete review
router.delete("/reviews/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid review ID." });
    }

    try {
        const [result] = await db.execute(
            "DELETE FROM parent_reviews WHERE review_id = ?",
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        return res.json({
            success: true,
            message: "Review deleted successfully."
        });
    } catch (error) {
        console.error("Delete review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not delete review."
        });
    }
});


// GET /teachers - List teachers
router.get("/teachers", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT teacher_id, name, email, whatsapp, gender,
                   country, qualification, photo_url, bio, specialization,
                   experience_years, display_order, is_active, created_at
            FROM teachers
            ORDER BY display_order ASC, created_at DESC
        `);

        return res.json({
            success: true,
            teachers: rows
        });
    } catch (error) {
        console.error("Teachers error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load teachers."
        });
    }
});

// POST /teachers - Add teacher
router.post("/teachers", async (req, res) => {
    const {
        name, email, whatsapp, gender, country, qualification,
        photo_url, bio, specialization, experience_years, display_order
    } = req.body;

    if (!name || !String(name).trim() || !["Male", "Female"].includes(gender)) {
        return res.status(400).json({
            success: false,
            message: "Teacher name and valid gender are required."
        });
    }

    try {
        const [result] = await db.execute(`
            INSERT INTO teachers
                (name, email, whatsapp, gender, country, qualification,
                 photo_url, bio, specialization, experience_years, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            String(name).trim(),
            email || null,
            whatsapp || null,
            gender,
            country || null,
            qualification || null,
            photo_url || null,
            bio || null,
            specialization || null,
            experience_years || null,
            Number.isFinite(Number(display_order)) ? Number(display_order) : 0
        ]);

        return res.status(201).json({
            success: true,
            message: "Teacher added successfully.",
            teacher_id: result.insertId
        });
    } catch (error) {
        console.error("Add teacher error:", error.message);

        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "This email is already registered."
                : "Could not add teacher."
        });
    }
});

// PUT /teachers/:id - Edit teacher
router.put("/teachers/:id", async (req, res) => {
    const { id } = req.params;
    const {
        name, email, whatsapp, gender, country, qualification,
        photo_url, bio, specialization, experience_years, display_order
    } = req.body;

    if (!validId(id) || !name || !String(name).trim() || !["Male", "Female"].includes(gender)) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid ID, name and gender."
        });
    }

    try {
        const [result] = await db.execute(`
            UPDATE teachers
            SET name = ?, email = ?, whatsapp = ?, gender = ?,
                country = ?, qualification = ?, photo_url = ?, bio = ?,
                specialization = ?, experience_years = ?, display_order = ?
            WHERE teacher_id = ?
        `, [
            String(name).trim(),
            email || null,
            whatsapp || null,
            gender,
            country || null,
            qualification || null,
            photo_url || null,
            bio || null,
            specialization || null,
            experience_years || null,
            Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
            Number(id)
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Teacher not found." });
        }

        return res.json({
            success: true,
            message: "Teacher updated successfully."
        });
    } catch (error) {
        console.error("Edit teacher error:", error.message);

        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "This email is already used by another teacher."
                : "Could not update teacher."
        });
    }
});

// PATCH /teachers/:id/active - Toggle teacher active status
router.patch("/teachers/:id/active", async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!validId(id) || ![true, false, 0, 1].includes(is_active)) {
        return res.status(400).json({
            success: false,
            message: "A valid teacher ID and active status are required."
        });
    }

    try {
        const [result] = await db.execute(
            "UPDATE teachers SET is_active = ? WHERE teacher_id = ?",
            [Number(Boolean(is_active)), Number(id)]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Teacher not found." });
        }

        return res.json({
            success: true,
            message: "Teacher status updated."
        });
    } catch (error) {
        console.error("Teacher status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update teacher status."
        });
    }
});

// =====================================
// 8. Course Management (CRUD)
// =====================================

// GET /courses - List with enrollment counts
router.get("/courses", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                c.course_id,
                c.course_name,
                c.description,
                c.image_url,
                c.slug,
                c.level,
                c.duration,
                c.display_order,
                c.is_active,
                c.created_at,
                COUNT(DISTINCT e.student_id) AS enrolled_students
            FROM courses c
            LEFT JOIN enrollments e
                ON c.course_id = e.course_id AND e.status = 'Active'
            GROUP BY c.course_id
            ORDER BY c.display_order ASC, c.course_name
        `);

        return res.json({
            success: true,
            courses: rows
        });
    } catch (error) {
        console.error("Courses error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load courses."
        });
    }
});

// POST /courses - Add course
router.post("/courses", async (req, res) => {
    const {
        course_name, description,
        image_url, slug, level, duration, display_order,
        syllabus, instructor, requirements, category
    } = req.body;

    if (!course_name || !String(course_name).trim()) {
        return res.status(400).json({
            success: false,
            message: "Please provide a course name."
        });
    }

    try {
        const uniqueSlug = await generateUniqueCourseSlug(db, slug || course_name);

        const [result] = await db.execute(`
            INSERT INTO courses
                (course_name, description, image_url, slug, level, duration,
                 display_order, syllabus, instructor, requirements, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            String(course_name).trim(),
            description || null,
            image_url || null,
            uniqueSlug,
            level || null,
            duration || null,
            Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
            syllabus || null,
            instructor || null,
            requirements || null,
            category || null
        ]);

        return res.status(201).json({
            success: true,
            message: "Course added successfully.",
            course_id: result.insertId,
            slug: uniqueSlug
        });
    } catch (error) {
        console.error("Add course error:", error.message);

        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A course with this name already exists."
                : "Could not add course."
        });
    }
});

// PUT /courses/:id - Edit course
router.put("/courses/:id", async (req, res) => {
    const { id } = req.params;
    const {
        course_name, description,
        image_url, slug, level, duration, display_order,
        syllabus, instructor, requirements, category
    } = req.body;

    if (!validId(id) || !course_name || !String(course_name).trim()) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid course ID and name."
        });
    }

    try {
        const uniqueSlug = await generateUniqueCourseSlug(db, slug || course_name, id);

        const [result] = await db.execute(`
            UPDATE courses
            SET course_name = ?, description = ?, image_url = ?, slug = ?,
                level = ?, duration = ?, display_order = ?,
                syllabus = COALESCE(?, syllabus),
                instructor = COALESCE(?, instructor),
                requirements = COALESCE(?, requirements),
                category = COALESCE(?, category)
            WHERE course_id = ?
        `, [
            String(course_name).trim(),
            description || null,
            image_url || null,
            uniqueSlug,
            level || null,
            duration || null,
            Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
            syllabus || null,
            instructor || null,
            requirements || null,
            category || null,
            Number(id)
        ]);

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Course not found." });
        }

        return res.json({
            success: true,
            message: "Course updated successfully.",
            slug: uniqueSlug
        });
    } catch (error) {
        console.error("Edit course error:", error.message);

        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A course with this name already exists."
                : "Could not update course."
        });
    }
});

// PATCH /courses/:id/active - Toggle course active
router.patch("/courses/:id/active", async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!validId(id) || ![true, false, 0, 1].includes(is_active)) {
        return res.status(400).json({
            success: false,
            message: "A valid course ID and active status are required."
        });
    }

    try {
        const [result] = await db.execute(
            "UPDATE courses SET is_active = ? WHERE course_id = ?",
            [Number(Boolean(is_active)), Number(id)]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Course not found." });
        }

        return res.json({
            success: true,
            message: "Course status updated."
        });
    } catch (error) {
        console.error("Course status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update course status."
        });
    }
});

// DELETE /courses/:id - Delete course
router.delete("/courses/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid course ID." });
    }

    try {
        // Check if there are active enrollments
        const [enrollmentRows] = await db.execute(
            "SELECT COUNT(*) AS total FROM enrollments WHERE course_id = ?",
            [Number(id)]
        );

        if (enrollmentRows[0].total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete course with active enrollments. Deactivate it instead."
            });
        }

        const [result] = await db.execute(
            "DELETE FROM courses WHERE course_id = ?",
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Course not found." });
        }

        return res.json({
            success: true,
            message: "Course deleted successfully."
        });
    } catch (error) {
        console.error("Delete course error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not delete course."
        });
    }
});

// =====================================
// 10. Site Content (dynamic website text/images)
// =====================================

// GET /site-content - full list for the admin editor
router.get("/site-content", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT setting_id, setting_key, setting_value, setting_group,
                    label, field_type, sort_order
             FROM site_settings
             ORDER BY setting_group ASC, sort_order ASC`
        );

        return res.json({
            success: true,
            settings: rows
        });
    } catch (error) {
        console.error("Site content list error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load website content."
        });
    }
});

// PUT /site-content - bulk update (only known keys are accepted)
router.put("/site-content", async (req, res) => {
    const updates = req.body && req.body.settings;

    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        return res.status(400).json({
            success: false,
            message: "Provide a 'settings' object of key/value pairs."
        });
    }

    const entries = Object.entries(updates);

    if (entries.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No settings were provided to update."
        });
    }

    if (entries.length > 200) {
        return res.status(400).json({
            success: false,
            message: "Too many settings in a single request."
        });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [knownRows] = await connection.query(
            "SELECT setting_key FROM site_settings"
        );
        const knownKeys = new Set(knownRows.map(r => r.setting_key));

        let updated = 0;
        for (const [key, value] of entries) {
            if (!knownKeys.has(key)) continue;

            const safeValue = value === null || value === undefined
                ? null
                : String(value);

            if (safeValue !== null && safeValue.length > 65000) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: `The value for "${key}" is too long.`
                });
            }

            const [result] = await connection.execute(
                `UPDATE site_settings SET setting_value = ? WHERE setting_key = ?`,
                [safeValue, key]
            );
            updated += result.affectedRows;
        }

        // Keep the stored WhatsApp link in sync with the central number so the
        // public API and any legacy consumer always point at the same place.
        // Clearing the number also clears the derived link.
        if (Object.prototype.hasOwnProperty.call(updates, "contact_whatsapp")) {
            const digits = String(updates.contact_whatsapp || "").replace(/[^0-9]/g, "");

            if (knownKeys.has("contact_whatsapp_link")) {
                const derivedLink = digits.length >= 8 ? `https://wa.me/${digits}` : "";

                const [linkResult] = await connection.execute(
                    `UPDATE site_settings SET setting_value = ? WHERE setting_key = ?`,
                    [derivedLink, "contact_whatsapp_link"]
                );
                updated += linkResult.affectedRows;
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message: `Website content updated (${updated} field${updated === 1 ? "" : "s"}).`,
            updated
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { /* ignore */ }
        }
        console.error("Site content update error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not save website content."
        });
    } finally {
        if (connection) connection.release();
    }
});

// =====================================
// 11. Student Performance Tracking
// =====================================

// GET /students/:id/performance - list performance records for a student
router.get("/students/:id/performance", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    try {
        const [rows] = await db.execute(
            `SELECT p.performance_id, p.student_id, p.course_id, p.teacher_id,
                    p.assessment_title, p.assessment_date, p.score, p.max_score,
                    p.attendance_percent, p.progress_level, p.progress_notes,
                    p.teacher_feedback, p.created_at, p.updated_at,
                    c.course_name,
                    t.name AS teacher_name
             FROM student_performance p
             LEFT JOIN courses c ON p.course_id = c.course_id
             LEFT JOIN teachers t ON p.teacher_id = t.teacher_id
             WHERE p.student_id = ?
             ORDER BY p.assessment_date DESC, p.performance_id DESC`,
            [Number(id)]
        );

        return res.json({
            success: true,
            performance: rows
        });
    } catch (error) {
        console.error("Student performance list error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not load performance records."
        });
    }
});

// POST /students/:id/performance - add a performance record
router.post("/students/:id/performance", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    const {
        course_id, teacher_id, assessment_title, assessment_date,
        score, max_score, attendance_percent, progress_level,
        progress_notes, teacher_feedback
    } = req.body || {};

    const title = String(assessment_title || "").trim();

    if (!title || title.length > 150) {
        return res.status(400).json({
            success: false,
            message: "An assessment title (max 150 characters) is required."
        });
    }

    const validLevels = ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement"];
    const level = progress_level ? String(progress_level) : null;

    if (level && !validLevels.includes(level)) {
        return res.status(400).json({
            success: false,
            message: "Invalid progress level value."
        });
    }

    const numericScore = score === "" || score === undefined || score === null ? null : Number(score);
    const numericMax = max_score === "" || max_score === undefined || max_score === null ? null : Number(max_score);
    const numericAttendance = attendance_percent === "" || attendance_percent === undefined || attendance_percent === null
        ? null
        : Number(attendance_percent);

    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0)) {
        return res.status(400).json({ success: false, message: "Score must be a non-negative number." });
    }

    if (numericMax !== null && (!Number.isFinite(numericMax) || numericMax < 0)) {
        return res.status(400).json({ success: false, message: "Max score must be a non-negative number." });
    }

    if (numericAttendance !== null && (!Number.isFinite(numericAttendance) || numericAttendance < 0 || numericAttendance > 100)) {
        return res.status(400).json({ success: false, message: "Attendance percent must be between 0 and 100." });
    }

    const adminId = req.admin?.sub ? Number(req.admin.sub) : null;

    try {
        const [result] = await db.execute(
            `INSERT INTO student_performance
                (student_id, course_id, teacher_id, assessment_title, assessment_date,
                 score, max_score, attendance_percent, progress_level, progress_notes,
                 teacher_feedback, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(id),
                validId(course_id) ? Number(course_id) : null,
                validId(teacher_id) ? Number(teacher_id) : null,
                title,
                assessment_date || null,
                numericScore,
                numericMax,
                numericAttendance,
                level,
                progress_notes ? String(progress_notes) : null,
                teacher_feedback ? String(teacher_feedback) : null,
                adminId
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Performance record added successfully.",
            performance_id: result.insertId
        });
    } catch (error) {
        console.error("Add performance error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not add the performance record."
        });
    }
});

// PUT /performance/:id - update a performance record
router.put("/performance/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid performance ID." });
    }

    const {
        course_id, teacher_id, assessment_title, assessment_date,
        score, max_score, attendance_percent, progress_level,
        progress_notes, teacher_feedback
    } = req.body || {};

    const title = String(assessment_title || "").trim();

    if (!title || title.length > 150) {
        return res.status(400).json({
            success: false,
            message: "An assessment title (max 150 characters) is required."
        });
    }

    const validLevels = ["Excellent", "Very Good", "Good", "Satisfactory", "Needs Improvement"];
    const level = progress_level ? String(progress_level) : null;

    if (level && !validLevels.includes(level)) {
        return res.status(400).json({
            success: false,
            message: "Invalid progress level value."
        });
    }

    const numericScore = score === "" || score === undefined || score === null ? null : Number(score);
    const numericMax = max_score === "" || max_score === undefined || max_score === null ? null : Number(max_score);
    const numericAttendance = attendance_percent === "" || attendance_percent === undefined || attendance_percent === null
        ? null
        : Number(attendance_percent);

    try {
        const [result] = await db.execute(
            `UPDATE student_performance
             SET course_id = ?, teacher_id = ?, assessment_title = ?, assessment_date = ?,
                 score = ?, max_score = ?, attendance_percent = ?, progress_level = ?,
                 progress_notes = ?, teacher_feedback = ?
             WHERE performance_id = ?`,
            [
                validId(course_id) ? Number(course_id) : null,
                validId(teacher_id) ? Number(teacher_id) : null,
                title,
                assessment_date || null,
                numericScore,
                numericMax,
                numericAttendance,
                level,
                progress_notes ? String(progress_notes) : null,
                teacher_feedback ? String(teacher_feedback) : null,
                Number(id)
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Performance record not found." });
        }

        return res.json({
            success: true,
            message: "Performance record updated successfully."
        });
    } catch (error) {
        console.error("Update performance error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not update the performance record."
        });
    }
});

// DELETE /performance/:id - delete a performance record
router.delete("/performance/:id", async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) {
        return res.status(400).json({ success: false, message: "Invalid performance ID." });
    }

    try {
        const [result] = await db.execute(
            "DELETE FROM student_performance WHERE performance_id = ?",
            [Number(id)]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Performance record not found." });
        }

        return res.json({
            success: true,
            message: "Performance record removed successfully."
        });
    } catch (error) {
        console.error("Delete performance error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not delete the performance record."
        });
    }
});

// =====================================
// 12. Image Upload
// POST /upload - raw binary image upload (content-type: image/*)
// Saves to images/uploads/ (or Frontend/images/uploads/) and returns a relative URL.
// =====================================

const UPLOAD_DIR = (function() {
    const candidates = [
        path.join(__dirname, "../images/uploads"),
        path.join(__dirname, "../Frontend/images/uploads"),
        "/home/jamranqu/public_html/images/uploads"
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return path.join(__dirname, "../images/uploads");
})();
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Detect an image type from the file's magic bytes (never trust the header)
function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { ext: "jpg", mime: "image/jpeg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E &&
        buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A &&
        buffer[6] === 0x1A && buffer[7] === 0x0A
    ) {
        return { ext: "png", mime: "image/png" };
    }

    // GIF: GIF87a / GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return { ext: "gif", mime: "image/gif" };
    }

    // WEBP: RIFF....WEBP
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
        buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 &&
        buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return { ext: "webp", mime: "image/webp" };
    }

    return null;
}

router.post(
    "/upload",
    express.raw({ type: "image/*", limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
        try {
            const buffer = req.body;

            if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No image data received. Send the raw image bytes with a Content-Type of image/*."
                });
            }

            if (buffer.length > MAX_UPLOAD_BYTES) {
                return res.status(413).json({
                    success: false,
                    message: "Image is too large. The maximum size is 5 MB."
                });
            }

            const type = detectImageType(buffer);

            if (!type) {
                return res.status(400).json({
                    success: false,
                    message: "Unsupported or invalid image file. Allowed formats: JPG, PNG, GIF, WEBP."
                });
            }

            await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

            const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${type.ext}`;
            const filepath = path.join(UPLOAD_DIR, filename);

            await fs.promises.writeFile(filepath, buffer);

            return res.status(201).json({
                success: true,
                message: "Image uploaded successfully.",
                url: `images/uploads/${filename}`,
                filename,
                size: buffer.length
            });
        } catch (error) {
            console.error("Image upload error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not save the uploaded image."
            });
        }
    }
);

module.exports = router;
