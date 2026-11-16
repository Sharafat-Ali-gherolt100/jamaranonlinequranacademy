const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("./db");
const { slugify, generateUniqueCourseSlug } = require("./slugHelper");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 1. MIDDLEWARE & STATIC ASSETS
// ============================================

app.use(cors());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// 1b. HELPERS
// ============================================

// Keep only digits so "+92 349 1894299" becomes "923491894299".
function whatsAppDigits(value) {
    return String(value || "").replace(/[^0-9]/g, "");
}

// Build a canonical wa.me link from the central WhatsApp number.
// If the number is not usable, fall back to an already-valid link.
function buildWhatsAppLink(number, fallbackLink) {
    const digits = whatsAppDigits(number);

    if (digits.length >= 8) {
        return `https://wa.me/${digits}`;
    }

    const fallback = String(fallbackLink || "").trim();

    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(fallback)) {
        return fallback;
    }

    return "";
}

// ============================================
// 1c. CLEAN URLS (no .html in public addresses)
// ============================================

function resolveFrontendPath() {
    if (process.env.FRONTEND_PATH && fs.existsSync(process.env.FRONTEND_PATH)) {
        return path.resolve(process.env.FRONTEND_PATH);
    }
    const candidates = [
        path.resolve(__dirname, ".."),                       // public_html directly
        "/home/jamranqu/public_html",                        // absolute public_html
        path.resolve(__dirname, "../Frontend"),              // legacy Frontend folder
        path.resolve(process.cwd(), "../Frontend"),
        path.resolve(process.cwd(), "Frontend"),
        path.resolve(__dirname, "Frontend")
    ];
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(path.join(candidate, "about.html")) || fs.existsSync(path.join(candidate, "index.html"))) {
                return candidate;
            }
        } catch (e) {}
    }
    return path.resolve(__dirname, "..");
}

const frontendPath = resolveFrontendPath();

// Redirect legacy ".html" addresses to their clean equivalent.
// Assets, API routes and non-HTML files are never touched.
app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    if (!req.path.toLowerCase().endsWith(".html")) return next();

    const queryIndex = req.url.indexOf("?");
    const suffix = queryIndex === -1 ? "" : req.url.slice(queryIndex);

    let target = req.path.slice(0, -5); // remove ".html"

    if (target === "/index") {
        target = "/";
    }

    return res.redirect(301, `${target}${suffix}`);
});

// Remove trailing slashes from clean page URLs so /courses/ and /courses
// resolve to the same place (no duplicate content).
app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    if (req.path.length <= 1 || !req.path.endsWith("/")) return next();
    if (path.extname(req.path)) return next();

    const queryIndex = req.url.indexOf("?");
    const suffix = queryIndex === -1 ? "" : req.url.slice(queryIndex);

    return res.redirect(301, `${req.path.replace(/\/+$/, "")}${suffix}`);
});

// Serve frontend static files. Directory redirects are disabled so that
// extensionless page URLs fall through to the clean URL resolver below.
app.use(express.static(frontendPath, { redirect: false }));

// ============================================
// 2. COURSE MAPPING
// ============================================

const courseMap = {
    // Dash slugs (original)
    "yassarnul-quran":  "Yassarnul Quran",
    "quran-tajweed":    "Quran with Tajweed",
    "duas-ziyarat":     "Duas and Ziyarat",
    "tafseer":          "Tafseer",
    "nahjul-balagha":   "Nahjul Balagha",
    "ahkam-namaz":      "Ahkam e Namaz",
    // Underscore slugs (match course HTML file names used in frontend URLs)
    "yassarnul_quran":  "Yassarnul Quran",
    "quran_tajweed":    "Quran with Tajweed",
    "duas_ziyarat":     "Duas and Ziyarat",
    "nahjul_balagha":   "Nahjul Balagha",
    "ahkam_namaz":      "Ahkam e Namaz",
    // Full display names (passed from dropdown select values)
    "shia yassarnul quran":  "Yassarnul Quran",
    "holy quran with tajweed": "Quran with Tajweed",
    "duas & ziyaraat":       "Duas and Ziyarat",
    "duas & ziyarat":        "Duas and Ziyarat",
    "duas and ziyaraat":     "Duas and Ziyarat",
    "tafseer of the quran":  "Tafseer",
    "nahjul balagha":        "Nahjul Balagha",
    "ahkam & namaz":         "Ahkam e Namaz",
    "ahkam and namaz":       "Ahkam e Namaz"
};

// ============================================
// 3. HOME & HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Jamaran Online Quran Academy API is operational.",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 3c. SEED / ADD FEATURED REVIEW
// ============================================
app.get("/api/seed-review", async (req, res) => {
    try {
        const parentName = req.query.name || "Muhammad Hussain";
        const [existing] = await db.execute(
            "SELECT review_id FROM parent_reviews WHERE parent_name = ? LIMIT 1",
            [parentName]
        );

        if (existing.length > 0) {
            await db.execute(
                `UPDATE parent_reviews 
                 SET status = 'Approved', consent_to_publish = 1, is_published = 1, published_at = NOW() 
                 WHERE parent_name = ?`,
                [parentName]
            );
            return res.json({
                success: true,
                message: `Review for ${parentName} updated and published!`,
                review_id: existing[0].review_id
            });
        }

        const [result] = await db.execute(
            `INSERT INTO parent_reviews (
                student_name,
                course_name,
                parent_name,
                relationship,
                parent_email,
                parent_phone,
                review_date,
                progress_feedback,
                strengths,
                areas_for_improvement,
                parent_comments,
                rating,
                consent_to_publish,
                is_published,
                published_at,
                status
            ) VALUES (
                'Ali Reza',
                'Quran with Tajweed',
                ?,
                'Father',
                'muhammad.hussain@example.com',
                '+92 300 1234567',
                CURRENT_DATE,
                'Alhamdulillah, wonderful learning experience. My son has shown great interest and improvement in Tajweed and daily Quran recitation.',
                'Good retention and clear Makharij pronunciation.',
                'Continuing to practice Surah memorization.',
                'Jamaran Online Quran Academy provides excellent qualified Shia teachers. Highly recommended for all parents!',
                5,
                1,
                1,
                NOW(),
                'Approved'
            )`,
            [parentName]
        );

        return res.json({
            success: true,
            message: `Review for ${parentName} added and published successfully!`,
            review_id: result.insertId
        });
    } catch (err) {
        console.error("Seed review error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.all("/api/deploy-webhook", (req, res) => {
    const secret = req.query.secret || req.body?.secret || req.headers["x-deploy-secret"];
    if (secret !== "JamaranDeploy2026") {
        return res.status(403).json({ success: false, message: "Unauthorized: Invalid secret" });
    }

    const repoPath = "/home/jamranqu/repositories/jamaranonlinequranacademy";
    const deployPath = "/home/jamranqu/public_html";

    // 1. Pull latest commits into the cPanel git repository
    // 2. Copy updated files directly into public_html (preserving .env and node_modules)
    const cmd = `git -C "${repoPath}" pull origin main 2>&1 && /bin/cp -rf "${repoPath}"/* "${deployPath}/" 2>&1 && /bin/cp -f "${repoPath}/.htaccess" "${deployPath}/.htaccess" 2>&1`;

    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
            console.error("Auto-deploy error:", err.message, stderr);
            return res.status(500).json({ success: false, error: err.message, stdout, stderr });
        }
        console.log("Auto-deploy output:", stdout);
        return res.json({
            success: true,
            message: "Production deployment completed successfully!",
            output: stdout
        });
    });
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "API is working successfully."
    });
});

// ============================================
// 4. DATABASE TEST ROUTE
// ============================================

app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT DATABASE() AS db_name");

        res.json({
            success: true,
            message: "Database connected successfully.",
            database: rows[0].db_name
        });
    } catch (error) {
        console.error("Database test error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// ============================================
// 5. ADMIN LOGIN
// POST /api/auth/login
// ============================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret || jwtSecret.length < 32) {
            console.error("JWT_SECRET is missing or shorter than 32 characters.");

            return res.status(500).json({
                success: false,
                message: "Server authentication is not configured correctly."
            });
        }

        const [admins] = await db.execute(
            `SELECT admin_id AS id, username, password_hash
             FROM admins
             WHERE username = ?
             LIMIT 1`,
            [username.trim()]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const admin = admins[0];

        const passwordMatches = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const token = jwt.sign(
            {
                sub: String(admin.id),
                username: admin.username,
                role: "admin"
            },
            jwtSecret,
            {
                expiresIn: "12h",
                issuer: "jamaran-academy"
            }
        );

        return res.json({
            success: true,
            message: "Login successful.",
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to process login right now."
        });
    }
});

// ============================================
// 6. STUDENT REGISTRATION
// POST /api/register
// ============================================

app.post("/api/register", async (req, res) => {
    let connection;

    try {
        const body = req.body || {};

        const studentName = String(body.name ?? body.full_name ?? "").trim();
        const studentEmail = String(body.email || "").trim().toLowerCase();
        const studentCountry = String(body.country || body.country_name || "").trim();
        const countryCode = String(body.country_code || "+92").trim();
        const whatsapp = String(body.phone || body.whatsapp || "").trim();

        const studentGenderRaw = String(body.gender || "").trim().toLowerCase();
        const studentGender = studentGenderRaw
            ? studentGenderRaw.charAt(0).toUpperCase() + studentGenderRaw.slice(1)
            : "";

        const courseValue = String(body.course || "").trim();

        const teacherPreferenceRaw = String(body.teacher_preference || "Any").trim().toLowerCase();
        const teacherPreference = teacherPreferenceRaw
            ? teacherPreferenceRaw.charAt(0).toUpperCase() + teacherPreferenceRaw.slice(1)
            : "Any";

        const preferredTimingRaw = String(body.timing || "Evening").trim().toLowerCase();
        const preferredTiming = preferredTimingRaw
            ? preferredTimingRaw.charAt(0).toUpperCase() + preferredTimingRaw.slice(1)
            : "Evening";

        const studentMessage = String(body.message || "").trim();
        const studentAge = Number(body.age);

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const countryCodePattern = /^\+[0-9]{1,5}$/;
        const phonePattern = /^[0-9\s()+-]{5,25}$/;

        // Validations
        if (studentName.length < 2 || studentName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 100 characters."
            });
        }

        if (!emailPattern.test(studentEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (studentCountry.length < 1 || studentCountry.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid country."
            });
        }

        if (!countryCodePattern.test(countryCode)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid country calling code."
            });
        }

        if (!phonePattern.test(whatsapp)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid WhatsApp number."
            });
        }

        if (!["Male", "Female"].includes(studentGender)) {
            return res.status(400).json({
                success: false,
                message: "Gender must be Male or Female."
            });
        }

        if (!Number.isInteger(studentAge) || studentAge < 3 || studentAge > 100) {
            return res.status(400).json({
                success: false,
                message: "Age must be between 3 and 100."
            });
        }

        if (!["Male", "Female", "Any"].includes(teacherPreference)) {
            return res.status(400).json({
                success: false,
                message: "Invalid teacher preference."
            });
        }

        if (!["Morning", "Afternoon", "Evening", "Night"].includes(preferredTiming)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid preferred timing."
            });
        }

        if (studentMessage.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 2000 characters."
            });
        }

        // Determine course name
        let targetCourseName = courseMap[courseValue];
        if (!targetCourseName) {
            // Check if course name was passed directly
            const matchedKey = Object.keys(courseMap).find(
                k => courseMap[k].toLowerCase() === courseValue.toLowerCase()
            );
            if (matchedKey) {
                targetCourseName = courseMap[matchedKey];
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid course."
                });
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Find active course
        const [courses] = await connection.execute(
            `SELECT course_id, course_name
             FROM courses
             WHERE course_name = ? AND is_active = 1
             LIMIT 1`,
            [targetCourseName]
        );

        if (courses.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "The selected course is currently unavailable."
            });
        }

        const selectedCourse = courses[0];

        // 2. Prevent duplicate pending/approved submissions for the same student and course
        const [duplicateCheck] = await connection.execute(
            `SELECT r.registration_id, r.status
             FROM registrations r
             JOIN registration_courses rc ON r.registration_id = rc.registration_id
             WHERE (
                 (r.email = ? AND r.email IS NOT NULL AND r.email <> '')
                 OR (r.whatsapp = ? AND r.country_code = ?)
             )
             AND rc.course_id = ?
             AND r.status IN ('Pending', 'Approved')
             LIMIT 1`,
            [studentEmail, whatsapp, countryCode, selectedCourse.course_id]
        );

        if (duplicateCheck.length > 0) {
            await connection.rollback();
            const existingStatus = duplicateCheck[0].status;
            return res.status(409).json({
                success: false,
                message: existingStatus === "Approved"
                    ? `You are already enrolled in ${selectedCourse.course_name}.`
                    : `A registration request for ${selectedCourse.course_name} is already pending review.`
            });
        }

        // 3. Insert registration record
        const [registrationResult] = await connection.execute(
            `INSERT INTO registrations
             (
                student_id,
                name,
                email,
                country,
                country_code,
                whatsapp,
                gender,
                age,
                teacher_preference,
                preferred_timing,
                message,
                status,
                created_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [
                null,
                studentName,
                studentEmail,
                studentCountry,
                countryCode,
                whatsapp,
                studentGender,
                studentAge,
                teacherPreference,
                preferredTiming,
                studentMessage || null
            ]
        );

        const registrationId = registrationResult.insertId;

        // 4. Link registration to selected course
        await connection.execute(
            `INSERT INTO registration_courses (registration_id, course_id)
             VALUES (?, ?)`,
            [registrationId, selectedCourse.course_id]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Registration submitted successfully! Our team will contact you shortly to confirm your class schedule.",
            registration_id: registrationId,
            course: selectedCourse.course_name,
            status: "Pending"
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error("Registration rollback error:", rbErr.message);
            }
        }

        console.error("Student registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Registration could not be completed. Please try again."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// ============================================
// 7. PARENT REVIEWS & STUDENT PROGRESS SYSTEM
// POST /api/reviews (Public Submission - Private by Default)
// GET /api/reviews/public (Approved & Consented Testimonials Only)
// ============================================

app.post("/api/reviews", async (req, res) => {
    try {
        const body = req.body || {};

        const parentName = String(body.parent_name || "").trim();
        const parentEmail = String(body.parent_email || "").trim().toLowerCase();
        const parentPhone = String(body.parent_phone || "").trim();
        const relationship = String(body.relationship || "").trim();
        const studentName = String(body.student_name || "").trim();
        const studentIdRaw = body.student_id;
        const courseParam = String(body.course || body.course_name || "").trim();
        const progressFeedback = String(body.progress_feedback || "").trim();
        const strengths = String(body.strengths || "").trim();
        const areasForImprovement = String(body.areas_for_improvement || "").trim();
        const parentComments = String(body.parent_comments || "").trim();
        const ratingRaw = body.rating;
        const consentToPublish = body.consent_to_publish === true || body.consent_to_publish === 1 || body.consent_to_publish === "1" ? 1 : 0;

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Validations
        if (parentName.length < 2 || parentName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Parent name must be between 2 and 100 characters."
            });
        }

        if (!emailPattern.test(parentEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid parent email address."
            });
        }

        if (studentName.length < 2 || studentName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Student name must be between 2 and 100 characters."
            });
        }

        if (relationship && relationship.length > 40) {
            return res.status(400).json({
                success: false,
                message: "Relationship must be 40 characters or fewer."
            });
        }

        if (!courseParam) {
            return res.status(400).json({
                success: false,
                message: "Please select the relevant course."
            });
        }

        if (progressFeedback.length < 10 || progressFeedback.length > 2500) {
            return res.status(400).json({
                success: false,
                message: "Progress feedback must be between 10 and 2500 characters."
            });
        }

        let rating = null;
        if (ratingRaw !== undefined && ratingRaw !== null && ratingRaw !== "") {
            const parsedRating = Number(ratingRaw);
            if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be an integer between 1 and 5."
                });
            }
            rating = parsedRating;
        }

        // Match course in courses table
        let courseId = null;
        let canonicalCourseName = courseParam;

        const [courses] = await db.execute(
            `SELECT course_id, course_name
             FROM courses
             WHERE course_name = ? OR course_name = ?
             LIMIT 1`,
            [courseParam, courseMap[courseParam] || courseParam]
        );

        if (courses.length > 0) {
            courseId = courses[0].course_id;
            canonicalCourseName = courses[0].course_name;
        }

        // Attempt to safely link student record if ID or verified email matches
        let studentId = null;
        if (studentIdRaw && /^\d+$/.test(String(studentIdRaw))) {
            const [matchedStudent] = await db.execute(
                `SELECT student_id, name FROM students WHERE student_id = ? LIMIT 1`,
                [Number(studentIdRaw)]
            );
            if (matchedStudent.length > 0) {
                studentId = matchedStudent[0].student_id;
            }
        }

        if (!studentId && studentName) {
            const [matchedByName] = await db.execute(
                `SELECT student_id FROM students WHERE LOWER(name) = ? LIMIT 1`,
                [studentName.toLowerCase()]
            );
            if (matchedByName.length > 0) {
                studentId = matchedByName[0].student_id;
            }
        }

        // Insert review as Pending (Private by default)
        const [result] = await db.execute(
            `INSERT INTO parent_reviews (
                student_id,
                student_name,
                course_id,
                course_name,
                parent_name,
                relationship,
                parent_email,
                parent_phone,
                review_date,
                progress_feedback,
                strengths,
                areas_for_improvement,
                parent_comments,
                rating,
                consent_to_publish,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                studentId,
                studentName,
                courseId,
                canonicalCourseName,
                parentName,
                relationship || null,
                parentEmail,
                parentPhone || null,
                progressFeedback,
                strengths || null,
                areasForImprovement || null,
                parentComments || null,
                rating,
                consentToPublish
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Thank you for your feedback! Your review has been securely submitted and will be kept private.",
            review_id: result.insertId
        });

    } catch (error) {
        console.error("Parent review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not submit review at this time. Please try again."
        });
    }
});

// GET /api/reviews/public - Explicitly published testimonials only
// A review appears publicly only when an admin has clicked "Publish"
// (is_published = 1) AND the parent gave consent AND the review is Approved.
app.get("/api/reviews/public", async (req, res) => {
    try {
        const [reviews] = await db.execute(
            `SELECT
                review_id,
                parent_name,
                relationship,
                course_name,
                student_name,
                parent_comments,
                progress_feedback,
                rating,
                review_date,
                created_at
             FROM parent_reviews
             WHERE status = 'Approved'
               AND consent_to_publish = 1
               AND is_published = 1
             ORDER BY published_at DESC, created_at DESC
             LIMIT 20`
        );

        // Sanitize: never expose private contact details, internal notes, or student IDs
        const publicReviews = reviews.map(r => ({
            id: r.review_id,
            review_id: r.review_id,
            parent_name: r.parent_name,
            relationship: r.relationship || "",
            course: r.course_name,
            course_name: r.course_name,
            student_display: r.student_name
                ? `${r.student_name.split(" ")[0]}...`
                : "Student",
            feedback: r.parent_comments || r.progress_feedback,
            parent_comments: r.parent_comments,
            progress_feedback: r.progress_feedback,
            rating: r.rating || 5,
            date: r.review_date
        }));

        res.json({
            success: true,
            reviews: publicReviews
        });

    } catch (error) {
        console.error("Public reviews error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load reviews."
        });
    }
});

// ============================================
// 8. CONTACT FORM
// POST /api/contact
// ============================================

app.post("/api/contact", async (req, res) => {
    try {
        const { name, email, subject, message, phone } = req.body || {};

        const contactName = String(name || "").trim();
        const contactEmail = String(email || "").trim();
        const contactPhone = String(phone || "").trim();
        const contactSubject = String(subject || "").trim();
        const contactMessage = String(message || "").trim();

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!contactName || !contactSubject || !contactMessage) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required contact form fields."
            });
        }

        if (contactEmail && !emailPattern.test(contactEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (
            contactName.length > 100 ||
            contactSubject.length > 200 ||
            contactMessage.length > 5000
        ) {
            return res.status(400).json({
                success: false,
                message: "Message exceeds character limits."
            });
        }

        const gmailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
        const gmailAppPassword = process.env.EMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
        const recipient = process.env.ADMIN_EMAIL || process.env.CONTACT_RECEIVER_EMAIL;

        // If email service is configured, send email; otherwise log and return success
        if (gmailUser && gmailAppPassword && recipient && !gmailUser.includes("your-real")) {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: gmailUser,
                    pass: gmailAppPassword
                }
            });

            await transporter.sendMail({
                from: `"Jamaran Online Quran Academy" <${gmailUser}>`,
                to: recipient,
                replyTo: contactEmail || gmailUser,
                subject: `Website Contact: ${contactSubject}`,
                text: [
                    "New message from Jamaran Online Quran Academy website:",
                    "",
                    `Name: ${contactName}`,
                    `Email: ${contactEmail || "Not provided"}`,
                    `Phone: ${contactPhone || "Not provided"}`,
                    `Subject: ${contactSubject}`,
                    "",
                    "Message:",
                    contactMessage
                ].join("\n")
            });
        } else {
            console.log("Contact submission received (SMTP not fully configured):", {
                contactName,
                contactEmail,
                contactPhone,
                contactSubject,
                contactMessage
            });
        }

        return res.status(200).json({
            success: true,
            message: "Your message has been received! Our team will get back to you shortly."
        });

    } catch (error) {
        console.error("Contact form error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to send your message right now. Please reach us directly via WhatsApp."
        });
    }
});

// ============================================
// 9. TOTAL ENROLLED STUDENTS COUNT
// Initial display count: 456
// GET /api/stats/total-enrolled-students
// ============================================

const INITIAL_STUDENTS_COUNT = 456;

app.get("/api/stats/total-enrolled-students", async (req, res) => {
    try {
        // Count distinct unique students in database
        // We identify students by normalized email or unique country_code + whatsapp
        const [regCountRows] = await db.query(`
            SELECT COUNT(DISTINCT CASE
                WHEN email IS NOT NULL AND TRIM(email) <> '' THEN LOWER(TRIM(email))
                ELSE CONCAT(country_code, whatsapp)
            END) AS total_registrations
            FROM registrations
        `);

        const [studentCountRows] = await db.query(`
            SELECT COUNT(DISTINCT CASE
                WHEN email IS NOT NULL AND TRIM(email) <> '' THEN LOWER(TRIM(email))
                ELSE CONCAT(country_code, whatsapp)
            END) AS total_students
            FROM students
        `);

        const uniqueRegistrations = Number(regCountRows[0].total_registrations) || 0;
        const uniqueStudents = Number(studentCountRows[0].total_students) || 0;
        const realCount = Math.max(uniqueRegistrations, uniqueStudents);

        res.json({
            success: true,
            initial_students: INITIAL_STUDENTS_COUNT,
            baseline: INITIAL_STUDENTS_COUNT,
            registered_students: realCount,
            total_students: INITIAL_STUDENTS_COUNT + realCount,
            total_enrolled: INITIAL_STUDENTS_COUNT + realCount
        });

    } catch (error) {
        console.error("Total students count error:", error.message);

        res.status(500).json({
            success: false,
            initial_students: INITIAL_STUDENTS_COUNT,
            baseline: INITIAL_STUDENTS_COUNT,
            registered_students: 0,
            total_students: INITIAL_STUDENTS_COUNT,
            total_enrolled: INITIAL_STUDENTS_COUNT,
            message: "Unable to fetch total students count."
        });
    }
});

// ============================================
// 10. PUBLIC CONTENT APIs (dynamic website)
// GET /api/courses/public   - active courses for public slider/grid
// GET /api/teachers/public  - active teachers for public page
// GET /api/site-content     - editable website text/images
// ============================================

// Course formatting helper
function formatCourse(c) {
    if (!c) return null;
    const computedSlug = c.slug || (c.course_name ? slugify(c.course_name) : `course-${c.course_id}`);
    let img = String(c.image_url || "").trim();
    if (img && !img.startsWith("/") && !img.startsWith("http")) {
        img = "/" + img;
    }
    return {
        id: c.course_id,
        course_id: c.course_id,
        name: c.course_name,
        course_name: c.course_name,
        title: c.course_name,
        description: c.description || "",
        image: img,
        image_url: img,
        slug: computedSlug,
        level: c.level || "",
        duration: c.duration || "",
        is_active: Number(c.is_active) === 1,
        display_order: c.display_order || 0,
        syllabus: c.syllabus || null,
        instructor: c.instructor || null,
        requirements: c.requirements || null,
        category: c.category || c.level || null,
        created_at: c.created_at || null
    };
}

// 1. GET /api/courses (and legacy /api/courses/public) — Retrieve all courses
app.get(["/api/courses", "/api/courses/public"], async (req, res) => {
    try {
        const includeInactive = req.query.all === "1" || req.query.admin === "1";
        const query = includeInactive
            ? "SELECT * FROM courses ORDER BY display_order ASC, course_id ASC"
            : "SELECT * FROM courses WHERE is_active = 1 ORDER BY display_order ASC, course_id ASC";

        const [courses] = await db.query(query);

        res.json({
            success: true,
            courses: courses.map(formatCourse)
        });
    } catch (error) {
        console.error("Courses API error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load courses."
        });
    }
});

// 2. GET /api/courses/:slug — Retrieve a specific course using its slug
app.get("/api/courses/:slug", async (req, res) => {
    try {
        const slugParam = String(req.params.slug || "").trim();
        if (!slugParam) {
            return res.status(400).json({ success: false, message: "Course slug is required." });
        }

        const normalizedHyphen = slugParam.replace(/_/g, "-");
        const normalizedUnderscore = slugParam.replace(/-/g, "_");

        let query;
        let params;

        // Check if numeric ID was passed
        if (/^\d+$/.test(slugParam)) {
            query = "SELECT * FROM courses WHERE course_id = ? LIMIT 1";
            params = [Number(slugParam)];
        } else {
            query = `SELECT * FROM courses
                     WHERE (slug = ? OR slug = ? OR slug = ? OR course_name = ?
                            OR LOWER(REPLACE(course_name, ' ', '-')) = ?
                            OR LOWER(REPLACE(course_name, ' ', '_')) = ?)
                     LIMIT 1`;
            params = [slugParam, normalizedHyphen, normalizedUnderscore, slugParam, normalizedHyphen.toLowerCase(), normalizedUnderscore.toLowerCase()];
        }

        const [rows] = await db.execute(query, params);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found."
            });
        }

        const course = rows[0];

        // Inactive check (unless admin preview)
        if (!course.is_active && req.query.preview !== "1") {
            return res.status(404).json({
                success: false,
                message: "Course is currently unavailable."
            });
        }

        res.json({
            success: true,
            course: formatCourse(course)
        });
    } catch (error) {
        console.error("Get course by slug error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load course details."
        });
    }
});

// 3. POST /api/courses — Create a new course and automatically generate its slug
app.post("/api/courses", async (req, res) => {
    const {
        course_name, description, image_url, slug,
        level, duration, display_order, is_active,
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
                 display_order, is_active, syllabus, instructor, requirements, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            String(course_name).trim(),
            description || null,
            image_url || null,
            uniqueSlug,
            level || null,
            duration || null,
            Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
            is_active !== undefined ? (Number(is_active) ? 1 : 0) : 1,
            syllabus || null,
            instructor || null,
            requirements || null,
            category || null
        ]);

        return res.status(201).json({
            success: true,
            message: "Course created successfully.",
            course_id: result.insertId,
            slug: uniqueSlug
        });
    } catch (error) {
        console.error("POST /api/courses error:", error.message);
        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A course with this name already exists."
                : "Could not create course."
        });
    }
});

// 4. PUT /api/courses/:id — Update an existing course
app.put("/api/courses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid course ID."
        });
    }

    const {
        course_name, description, image_url, slug,
        level, duration, display_order, is_active,
        syllabus, instructor, requirements, category
    } = req.body;

    if (!course_name || !String(course_name).trim()) {
        return res.status(400).json({
            success: false,
            message: "Please provide a course name."
        });
    }

    try {
        const uniqueSlug = await generateUniqueCourseSlug(db, slug || course_name, id);

        const [result] = await db.execute(`
            UPDATE courses
            SET course_name = ?, description = ?, image_url = ?, slug = ?,
                level = ?, duration = ?, display_order = ?,
                is_active = COALESCE(?, is_active),
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
            is_active !== undefined ? (Number(is_active) ? 1 : 0) : null,
            syllabus || null,
            instructor || null,
            requirements || null,
            category || null,
            id
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
        console.error("PUT /api/courses/:id error:", error.message);
        return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A course with this name already exists."
                : "Could not update course."
        });
    }
});

// 5. DELETE /api/courses/:id — Delete a course
app.delete("/api/courses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid course ID."
        });
    }

    try {
        const [enrollments] = await db.execute(
            "SELECT COUNT(*) AS count FROM enrollments WHERE course_id = ? AND status = 'Active'",
            [id]
        );

        if (enrollments[0]?.count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete this course because ${enrollments[0].count} active student(s) are currently enrolled.`
            });
        }

        const [result] = await db.execute("DELETE FROM courses WHERE course_id = ?", [id]);
        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Course not found." });
        }

        return res.json({
            success: true,
            message: "Course deleted successfully."
        });
    } catch (error) {
        console.error("DELETE /api/courses/:id error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Could not delete course."
        });
    }
});

// GET /api/teachers/public
app.get("/api/teachers/public", async (req, res) => {
    try {
        const [teachers] = await db.query(
            `SELECT
                teacher_id,
                name,
                qualification,
                photo_url,
                bio,
                specialization,
                experience_years,
                gender,
                display_order
             FROM teachers
             WHERE is_active = 1
             ORDER BY display_order ASC, teacher_id ASC`
        );

        res.json({
            success: true,
            teachers: teachers.map(t => ({
                id: t.teacher_id,
                name: t.name,
                qualification: t.qualification || "",
                photo: t.photo_url || "",
                bio: t.bio || "",
                specialization: t.specialization || "",
                experience: t.experience_years || "",
                gender: (t.gender || "").toLowerCase()
            }))
        });
    } catch (error) {
        console.error("Public teachers error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load teachers."
        });
    }
});

// GET /api/site-content  (public read-only view of editable content)
app.get("/api/site-content", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT setting_key, setting_value
             FROM site_settings
             ORDER BY sort_order ASC`
        );

        const content = {};
        rows.forEach(row => {
            content[row.setting_key] = row.setting_value || "";
        });

        // The central WhatsApp number is the single source of truth.
        // Always expose a canonical wa.me link derived from it so every
        // page/button uses the same destination.
        const canonicalWhatsAppLink = buildWhatsAppLink(
            content.contact_whatsapp,
            content.contact_whatsapp_link
        );

        if (canonicalWhatsAppLink) {
            content.contact_whatsapp_link = canonicalWhatsAppLink;
        }

        content.contact_whatsapp_digits = whatsAppDigits(content.contact_whatsapp);

        res.json({
            success: true,
            content
        });
    } catch (error) {
        console.error("Public site content error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load site content."
        });
    }
});

// Redirect legacy dashboard route to the clean admin dashboard URL
app.get("/dashboard", (req, res) => {
    res.redirect(301, "/admin_dashboard");
});

// ============================================
// 11. ADMIN DASHBOARD ROUTES
// ============================================

app.use("/api/admin", require("./adminRoutes"));

// ============================================
// 12. HANDLE UNKNOWN API ROUTES
// ============================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

// Debug path diagnostic endpoint
app.get("/api/debug-path", (req, res) => {
    res.json({
        __dirname,
        cwd: process.cwd(),
        frontendPath,
        frontendExists: fs.existsSync(frontendPath),
        indexExists: fs.existsSync(path.join(frontendPath, "index.html")),
        parentFiles: fs.existsSync(path.join(__dirname, "..")) ? fs.readdirSync(path.join(__dirname, "..")) : []
    });
});

// Fallback to frontend index.html for root if needed
app.get("/", (req, res, next) => {
    const indexPath = path.join(frontendPath, "index.html");
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    return res.status(404).send(`index.html not found at ${indexPath}`);
});

// ============================================
// DYNAMIC COURSE DETAILS ROUTING
// /courses/:slug -> Frontend/course-details.html
// ============================================
app.get("/courses/:slug", (req, res, next) => {
    const slug = req.params.slug;
    // Let files with extension pass to static handler
    if (path.extname(slug)) return next();

    // Reusable dynamic course details page
    res.sendFile(path.join(frontendPath, "course-details.html"));
});

// Clean URL fallback:
//   /about                -> Frontend/about.html
//   /courses/tafseer      -> Frontend/courses/tafseer.html
//   /courses              -> Frontend/courses.html
// Only extensionless GET/HEAD requests are considered, so assets and
// API routes keep working exactly as before.
app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    if (path.extname(req.path)) return next();

    const relativePath = decodeURIComponent(req.path).replace(/^\/+/, "");

    const candidates = relativePath
        ? [
            path.join(frontendPath, `${relativePath}.html`),
            path.join(frontendPath, relativePath, "index.html")
        ]
        : [path.join(frontendPath, "index.html")];

    for (const candidate of candidates) {
        if (!candidate.startsWith(frontendPath)) continue;

        try {
            if (fs.statSync(candidate).isFile()) {
                return res.sendFile(candidate);
            }
        } catch (error) {
            // Try the next candidate.
        }
    }

    return next();
});

// ============================================
// 13. GLOBAL ERROR HANDLER
// ============================================

app.use((error, req, res, next) => {
    console.error("Unexpected server error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    // Body-parser payload errors (e.g. an image over the upload limit)
    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "The uploaded file is too large. The maximum allowed size is 5 MB."
        });
    }

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "The request could not be processed."
        });
    }

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

// ============================================
// 14. START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`Jamaran Academy server running at http://localhost:${PORT}`);
});