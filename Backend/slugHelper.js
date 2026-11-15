/**
 * slugHelper.js
 * Automatic unique slug generation for courses.
 */

function slugify(text) {
    if (!text) return "";
    return String(text)
        .toLowerCase()
        .trim()
        // Replace special characters and symbols (retain letters, digits, whitespace, hyphens)
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        // Replace spaces, underscores and multiple hyphens with a single hyphen
        .replace(/[\s_-]+/g, "-")
        // Trim leading and trailing hyphens
        .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug for a course.
 * If the base slug already exists, automatically appends -1, -2, -3, etc.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} titleOrSlug - course title or custom slug
 * @param {number|null} existingCourseId - optional course_id to exclude when updating
 * @returns {Promise<string>} unique slug
 */
async function generateUniqueCourseSlug(db, titleOrSlug, existingCourseId = null) {
    let base = slugify(titleOrSlug);
    if (!base) base = "course";

    let candidate = base;
    let counter = 1;

    while (true) {
        let query;
        let params;

        if (existingCourseId) {
            query = "SELECT course_id FROM courses WHERE slug = ? AND course_id != ? LIMIT 1";
            params = [candidate, Number(existingCourseId)];
        } else {
            query = "SELECT course_id FROM courses WHERE slug = ? LIMIT 1";
            params = [candidate];
        }

        const [rows] = await db.execute(query, params);
        if (rows.length === 0) {
            return candidate;
        }

        candidate = `${base}-${counter}`;
        counter++;
    }
}

module.exports = {
    slugify,
    generateUniqueCourseSlug
};
