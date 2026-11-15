-- =============================================================
-- Migration 003 — Dynamic content, media & student performance
-- Jamaran Online Quran Academy
--
-- Purpose
--   Adds the smallest compatible schema additions needed for:
--     1. Editable website content (homepage / about / contact / images)
--     2. Teacher public profile fields (photo, bio, subjects, order)
--     3. Course public presentation fields (image, slug, level, order)
--     4. Reviewer relationship ("Mother", "Father", ...) on reviews
--     5. Student performance tracking (progress/attendance/assessment
--        /teacher feedback)
--
-- Safety
--   • Every statement is additive — no row is ever deleted or
--     overwritten by this migration.
--   • Existing admins, students, teachers, courses, registrations,
--     enrollments and reviews are preserved untouched.
--   • Seed rows use INSERT ... ON DUPLICATE KEY UPDATE so re-running
--     the file is safe and never clobbers admin edits.
--   • Requires MySQL 8.0+ (ADD COLUMN IF NOT EXISTS).
-- =============================================================

-- -------------------------------------------------------------
-- 1. Editable website content (key/value store)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `setting_key`  VARCHAR(100) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `label`        VARCHAR(150) DEFAULT NULL,
  `field_type`   ENUM('text','textarea','image','url','html') NOT NULL DEFAULT 'text',
  `sort_order`   INT(11) NOT NULL DEFAULT 0,
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `unique_setting_key` (`setting_key`),
  KEY `idx_setting_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------------------------------------------------------------
-- 2. Teacher public profile fields
-- -------------------------------------------------------------
ALTER TABLE `teachers`
    ADD COLUMN IF NOT EXISTS `photo_url`       VARCHAR(255)  DEFAULT NULL AFTER `qualification`,
    ADD COLUMN IF NOT EXISTS `bio`             TEXT          DEFAULT NULL AFTER `photo_url`,
    ADD COLUMN IF NOT EXISTS `specialization`  VARCHAR(150)  DEFAULT NULL AFTER `bio`,
    ADD COLUMN IF NOT EXISTS `experience_years` VARCHAR(40)  DEFAULT NULL AFTER `specialization`,
    ADD COLUMN IF NOT EXISTS `display_order`   INT(11) NOT NULL DEFAULT 0 AFTER `is_active`;

-- -------------------------------------------------------------
-- 3. Course public presentation fields
-- -------------------------------------------------------------
ALTER TABLE `courses`
    ADD COLUMN IF NOT EXISTS `image_url`     VARCHAR(255) DEFAULT NULL AFTER `description`,
    ADD COLUMN IF NOT EXISTS `slug`          VARCHAR(120) DEFAULT NULL AFTER `image_url`,
    ADD COLUMN IF NOT EXISTS `level`         VARCHAR(80)  DEFAULT NULL AFTER `slug`,
    ADD COLUMN IF NOT EXISTS `duration`      VARCHAR(80)  DEFAULT NULL AFTER `level`,
    ADD COLUMN IF NOT EXISTS `display_order` INT(11) NOT NULL DEFAULT 0 AFTER `is_active`;

-- -------------------------------------------------------------
-- 4. Reviewer relationship on parent reviews
-- -------------------------------------------------------------
ALTER TABLE `parent_reviews`
    ADD COLUMN IF NOT EXISTS `relationship` VARCHAR(40) DEFAULT NULL
        COMMENT 'Reviewer relationship to the student, e.g. Mother, Father, Guardian'
        AFTER `parent_name`;

-- -------------------------------------------------------------
-- 5. Student performance tracking
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `student_performance` (
  `performance_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `student_id`       INT(11) NOT NULL,
  `course_id`        INT(11) DEFAULT NULL,
  `teacher_id`       INT(11) DEFAULT NULL,
  `assessment_title` VARCHAR(150) NOT NULL,
  `assessment_date`  DATE DEFAULT NULL,
  `score`            DECIMAL(6,2) DEFAULT NULL,
  `max_score`        DECIMAL(6,2) DEFAULT NULL,
  `attendance_percent` DECIMAL(5,2) DEFAULT NULL,
  `progress_level`   ENUM('Excellent','Very Good','Good','Satisfactory','Needs Improvement') DEFAULT NULL,
  `progress_notes`   TEXT DEFAULT NULL,
  `teacher_feedback` TEXT DEFAULT NULL,
  `recorded_by`      INT(11) DEFAULT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`performance_id`),
  KEY `idx_perf_student` (`student_id`),
  KEY `idx_perf_course` (`course_id`),
  KEY `idx_perf_teacher` (`teacher_id`),
  CONSTRAINT `fk_perf_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_perf_course`  FOREIGN KEY (`course_id`)  REFERENCES `courses` (`course_id`)  ON DELETE SET NULL,
  CONSTRAINT `fk_perf_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`teacher_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_perf_admin`   FOREIGN KEY (`recorded_by`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------------------------------------------------------------
-- 6. Seed editable content with the academy's current wording.
--    These values mirror the existing hard-coded text so the site
--    looks identical until an admin edits something.
-- -------------------------------------------------------------
INSERT INTO `site_settings`
  (`setting_key`, `setting_value`, `setting_group`, `label`, `field_type`, `sort_order`) VALUES
  ('hero_heading',         'Learn with Shia Aalim-e-Deen', 'homepage', 'Hero Heading', 'text', 1),
  ('hero_subheading',      'Learn Quran & Islamic Teachings Online With Qualified Shia Aalim-e-Deen', 'homepage', 'Hero Subheading', 'textarea', 2),
  ('hero_highlight',       'Quran • Qaida • Nahjul Balagha • Ahkam', 'homepage', 'Hero Highlight Line', 'text', 3),
  ('hero_image_1',         'images/Image1.png', 'homepage', 'Hero Background Image 1', 'image', 4),
  ('hero_image_2',         'images/Image2.png', 'homepage', 'Hero Background Image 2', 'image', 5),
  ('hero_image_3',         'images/image3.png', 'homepage', 'Hero Background Image 3', 'image', 6),
  ('about_subtitle',       '— Welcome to Our Academy —', 'homepage', 'About Subtitle', 'text', 10),
  ('about_heading',        'JAMARAN ONLINE QURAN ACADEMY', 'homepage', 'About Heading', 'text', 11),
  ('about_text',           'Jamaran Online Quran Academy is dedicated to providing quality online Quran education for children and adults. Our aim is to provide simple, reliable, and engaging online education with proper guidance from experienced teachers.', 'homepage', 'About Paragraph', 'textarea', 12),
  ('about_image',          'images/logo (3).png', 'homepage', 'Homepage About Image', 'image', 13),
  ('courses_heading',      'Courses We Offer', 'homepage', 'Courses Section Heading', 'text', 20),
  ('courses_subtitle',     '— Our Courses —', 'homepage', 'Courses Section Subtitle', 'text', 21),
  ('whyus_heading',        'Why Choose Jamaran Academy?', 'homepage', 'Why Choose Us Heading', 'text', 30),
  ('whyus_subtitle',       '— Why Choose Us —', 'homepage', 'Why Choose Us Subtitle', 'text', 31),
  ('whyus_text',           'We provide convenient, flexible, and quality online Quran education for students of all ages.', 'homepage', 'Why Choose Us Paragraph', 'textarea', 32),
  ('trial_heading',        'Start Your Quran Learning Journey', 'homepage', 'Trial Box Heading', 'text', 40),
  ('trial_text',           'Join from anywhere — Learn at your convenience!', 'homepage', 'Trial Box Paragraph', 'textarea', 41),
  ('feedback_heading',     'What Parents Say About Us', 'homepage', 'Testimonials Heading', 'text', 50),
  ('feedback_subtitle',    '— PARENT FEEDBACK —', 'homepage', 'Testimonials Subtitle', 'text', 51),
  ('feedback_text',        'We are grateful for the trust and feedback of parents who choose Jamaran Online Quran Academy for their children.', 'homepage', 'Testimonials Paragraph', 'textarea', 52),
  ('footer_about_text',    'Learn the Quran. Understand its teachings. Build a stronger connection with faith.', 'general', 'Footer About Text', 'textarea', 60),

  ('about_page_subtitle',  '— ABOUT OUR ACADEMY —', 'about', 'About Page Subtitle', 'text', 70),
  ('about_page_heading',   'Learn the Quran with Proper Guidance', 'about', 'About Page Heading', 'text', 71),
  ('about_page_text_1',    'Jamaran Online Quran Academy is dedicated to providing quality online Quran education for children and adults. Our mission is to make Quranic and Islamic education accessible to students from anywhere in the world.', 'about', 'About Page Paragraph 1', 'textarea', 72),
  ('about_page_text_2',    'We provide a comfortable and flexible online learning environment where students can learn according to their individual needs and schedules under the guidance of qualified and experienced teachers.', 'about', 'About Page Paragraph 2', 'textarea', 73),
  ('about_page_image',     'images/about_page.png', 'about', 'About Page Image', 'image', 74),
  ('founder_heading',      'Meet Our Founder', 'about', 'Founder Heading', 'text', 80),
  ('founder_name',         'Nawazish Ali', 'about', 'Founder Name', 'text', 81),
  ('founder_position',     'Founder & Director', 'about', 'Founder Position', 'text', 82),
  ('founder_message',      'Our goal is to make quality Quranic and Islamic education accessible to everyone, regardless of their location or busy daily schedule. Through Jamaran Online Quran Academy, we aim to provide a supportive learning environment where students can develop a stronger connection with the Holy Quran and Islamic teachings.', 'about', 'Founder Message', 'textarea', 83),
  ('founder_image',        'images/quran.jpeg', 'about', 'Founder Image', 'image', 84),

  ('contact_phone',        '+92 349 1894299', 'contact', 'Phone Number', 'text', 90),
  ('contact_whatsapp',     '+92 349 1894299', 'contact', 'WhatsApp Number', 'text', 91),
  ('contact_whatsapp_link','https://wa.me/923491894299', 'contact', 'WhatsApp Link', 'url', 92),
  ('contact_email',        'info@jamaranacademy.com', 'contact', 'Email Address', 'text', 93),
  ('contact_address',      'Your Address, City, Country', 'contact', 'Address', 'text', 94),
  ('contact_hours',        'Mon - Sat (9:00 AM - 7:00 PM)', 'contact', 'Opening Hours', 'text', 95),
  ('contact_languages',    'Urdu • English • Farsi', 'contact', 'Languages Offered', 'text', 96),
  ('social_facebook',      '', 'contact', 'Facebook URL', 'url', 97),
  ('social_youtube',       '', 'contact', 'YouTube URL', 'url', 98),
  ('social_instagram',     '', 'contact', 'Instagram URL', 'url', 99)
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- -------------------------------------------------------------
-- 7. Link existing courses to their existing images / pages so the
--    dynamic homepage slider matches today's design immediately.
--    Only fills values that are still empty.
-- -------------------------------------------------------------
UPDATE `courses` SET
  `image_url` = CASE
      WHEN `course_name` LIKE '%Yassarnul%'  THEN 'images/yassarnal quran.png'
      WHEN `course_name` LIKE '%Tajweed%'    THEN 'images/Quran with tarjuma.png'
      WHEN `course_name` LIKE '%Duas%'       THEN 'images/Dua.png'
      WHEN `course_name` LIKE '%Tafseer%'    THEN 'images/tafseer quran.png'
      WHEN `course_name` LIKE '%Nahjul%'     THEN 'images/nahjul balagha.png'
      WHEN `course_name` LIKE '%Namaz%'      THEN 'images/namz.png'
      ELSE `image_url`
  END,
  `slug` = CASE
      WHEN `course_name` LIKE '%Yassarnul%'  THEN 'yassarnul_quran'
      WHEN `course_name` LIKE '%Tajweed%'    THEN 'quran_tajweed'
      WHEN `course_name` LIKE '%Duas%'       THEN 'duas_ziyarat'
      WHEN `course_name` LIKE '%Tafseer%'    THEN 'tafseer'
      WHEN `course_name` LIKE '%Nahjul%'     THEN 'nahjul_balagha'
      WHEN `course_name` LIKE '%Namaz%'      THEN 'ahkam_namaz'
      ELSE `slug`
  END,
  `level` = CASE
      WHEN `course_name` LIKE '%Yassarnul%'  THEN 'Foundation Level'
      WHEN `course_name` LIKE '%Tajweed%'    THEN 'Intermediate & Advanced'
      WHEN `course_name` LIKE '%Duas%'       THEN 'Spiritual Studies'
      WHEN `course_name` LIKE '%Tafseer%'    THEN 'Deep Comprehension'
      WHEN `course_name` LIKE '%Nahjul%'     THEN 'Wisdom of Imam Ali (AS)'
      WHEN `course_name` LIKE '%Namaz%'      THEN 'Practical Jurisprudence'
      ELSE `level`
  END
WHERE (`image_url` IS NULL OR `image_url` = '')
   OR (`slug` IS NULL OR `slug` = '');

-- -------------------------------------------------------------
-- 8. Verification helper (informational only)
-- -------------------------------------------------------------
SELECT `setting_group`, COUNT(*) AS total_settings
FROM `site_settings`
GROUP BY `setting_group`
ORDER BY `setting_group`;
