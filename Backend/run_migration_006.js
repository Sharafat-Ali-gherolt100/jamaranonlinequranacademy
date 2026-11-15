const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const db = require("./db");

async function run() {
    console.log("Applying Migration 006: Dynamic Course Slugs & Rich Metadata...");
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Add optional rich metadata columns if they don't exist
        const [existingCols] = await connection.query("SHOW COLUMNS FROM courses");
        const colNames = existingCols.map(c => c.Field);

        if (!colNames.includes("syllabus")) {
            await connection.query("ALTER TABLE `courses` ADD COLUMN `syllabus` TEXT DEFAULT NULL AFTER `duration`");
            console.log("Added column: syllabus");
        }
        if (!colNames.includes("instructor")) {
            await connection.query("ALTER TABLE `courses` ADD COLUMN `instructor` VARCHAR(150) DEFAULT NULL AFTER `syllabus`");
            console.log("Added column: instructor");
        }
        if (!colNames.includes("requirements")) {
            await connection.query("ALTER TABLE `courses` ADD COLUMN `requirements` TEXT DEFAULT NULL AFTER `instructor`");
            console.log("Added column: requirements");
        }
        if (!colNames.includes("category")) {
            await connection.query("ALTER TABLE `courses` ADD COLUMN `category` VARCHAR(100) DEFAULT NULL AFTER `requirements`");
            console.log("Added column: category");
        }

        // 2. Ensure default courses have rich content and valid slugs
        const defaultCourses = [
            {
                id: 1,
                name: "Yassarnul Quran",
                slug: "yassarnul-quran",
                desc: "Our Yassarnul Quran course is designed for students who want to learn the basics of Quran reading in a simple and effective way. Students will learn Arabic letters, pronunciation, joining letters, words, and basic Quran reading skills under the guidance of qualified Shia teachers.",
                duration: "3 - 6 Months",
                level: "Foundation Level",
                category: "Quranic Basics",
                syllabus: "Arabic letters and pronunciation\nJoining Arabic letters\nBasic Quran reading\nCorrect pronunciation\nRegular reading practice",
                requirements: "No prior knowledge required. Suitable for children and adult beginners."
            },
            {
                id: 2,
                name: "Quran with Tajweed",
                slug: "quran-tajweed",
                desc: "Our Quran with Tajweed course helps students improve their Quran recitation by learning the correct pronunciation and rules of Tajweed. Students will learn how to pronounce Arabic letters correctly and apply Tajweed rules while reading the Holy Quran.",
                duration: "6 - 12 Months",
                level: "Intermediate & Advanced",
                category: "Tajweed & Recitation",
                syllabus: "Correct pronunciation of Arabic letters\nBasic and advanced Tajweed rules\nMakharij of Arabic letters\nRules of Noon Sakin and Tanween\nRules of Meem Sakin\nQuran recitation practice",
                requirements: "Basic ability to read Arabic or completion of Yassarnul Quran."
            },
            {
                id: 3,
                name: "Duas and Ziyarat",
                slug: "duas-ziyarat",
                desc: "Our Duas and Ziyaraat course is designed to help students learn important supplications and Ziyaraat in a simple and structured way. Students will learn correct pronunciation, memorization and the meanings of selected Duas and Ziyaraat.",
                duration: "3 - 6 Months",
                level: "Spiritual Studies",
                category: "Spiritual Studies",
                syllabus: "Daily important Duas\nSelected Ziyaraat\nCorrect pronunciation\nMemorization techniques\nMeaning and understanding\nRegular practice and revision",
                requirements: "Open to all age groups with a desire for spiritual learning."
            },
            {
                id: 4,
                name: "Tafseer",
                slug: "tafseer",
                desc: "Our Tafseer course helps students develop a deeper understanding of the Holy Quran and its important teachings. Students will study selected verses and learn their meanings, lessons and practical guidance in a structured learning environment.",
                duration: "6 - 12 Months",
                level: "Deep Comprehension",
                category: "Deep Comprehension",
                syllabus: "Meaning of selected Quranic verses\nExplanation and context of verses\nImportant Quranic teachings\nMoral and spiritual lessons\nPractical guidance from the Quran\nQuestion and discussion sessions",
                requirements: "Ability to read the Quran."
            },
            {
                id: 5,
                name: "Nahjul Balagha",
                slug: "nahjul-balagha",
                desc: "Our Nahjul Balagha course introduces students to selected sermons, letters and sayings and their valuable lessons. The course focuses on understanding the wisdom, ethics, character and guidance contained in Nahjul Balagha.",
                duration: "6 Months",
                level: "Wisdom of Imam Ali (AS)",
                category: "Islamic Literature",
                syllabus: "Introduction to Nahjul Balagha\nSelected sermons and their meanings\nSelected letters and teachings\nWisdom and sayings\nMoral and ethical guidance\nPractical lessons for daily life",
                requirements: "Open to youths and adults seeking profound moral and spiritual insight."
            },
            {
                id: 6,
                name: "Ahkam e Namaz",
                slug: "ahkam-namaz",
                desc: "Our Ahkam and Namaz course helps students learn essential Islamic rulings and understand the correct method of performing daily prayers. Students will learn the basic requirements of Namaz along with important practical Islamic rulings for everyday life.",
                duration: "2 - 4 Months",
                level: "Practical Jurisprudence",
                category: "Fiqh & Jurisprudence",
                syllabus: "Importance and basics of Namaz\nWudu and purification\nCorrect method of performing Namaz\nEssential parts of Namaz\nCommon mistakes in prayer\nBasic Islamic rulings for daily life",
                requirements: "Open to all momineen and mominaat of all ages."
            }
        ];

        for (const c of defaultCourses) {
            await connection.execute(
                `UPDATE courses
                 SET description = COALESCE(description, ?),
                     duration = COALESCE(duration, ?),
                     syllabus = COALESCE(syllabus, ?),
                     requirements = COALESCE(requirements, ?),
                     category = COALESCE(category, ?)
                 WHERE course_id = ?`,
                [c.desc, c.duration, c.syllabus, c.requirements, c.category, c.id]
            );
        }

        await connection.commit();
        console.log("Migration 006 completed successfully!");
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error("Migration 006 failed:", err.message);
        process.exit(1);
    } finally {
        connection.release();
    }
}

run();
