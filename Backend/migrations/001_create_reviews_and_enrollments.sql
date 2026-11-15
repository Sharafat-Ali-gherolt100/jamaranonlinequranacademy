-- Jamaran Online Quran Academy
-- Safe Database Migration Script
-- Step 1: Create enrollments and parent_reviews tables

-- 1. Enrollments Table
-- Maintains student-course enrollments over time, supporting multi-course enrollments
CREATE TABLE IF NOT EXISTS `enrollments` (
  `enrollment_id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_id` INT(11) NOT NULL,
  `course_id` INT(11) NOT NULL,
  `registration_id` INT(11) DEFAULT NULL,
  `status` ENUM('Active', 'Completed', 'Paused', 'Cancelled') NOT NULL DEFAULT 'Active',
  `enrolled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `unique_student_course` (`student_id`, `course_id`),
  KEY `fk_enrollment_course` (`course_id`),
  KEY `fk_enrollment_registration` (`registration_id`),
  CONSTRAINT `fk_enrollment_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Parent Reviews Table
-- Allows parents/guardians to submit progress feedback. Private by default.
CREATE TABLE IF NOT EXISTS `parent_reviews` (
  `review_id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_id` INT(11) DEFAULT NULL,
  `student_name` VARCHAR(100) NOT NULL,
  `course_id` INT(11) DEFAULT NULL,
  `course_name` VARCHAR(100) NOT NULL,
  `parent_name` VARCHAR(100) NOT NULL,
  `parent_email` VARCHAR(150) NOT NULL,
  `parent_phone` VARCHAR(25) DEFAULT NULL,
  `review_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `progress_feedback` TEXT NOT NULL,
  `strengths` TEXT DEFAULT NULL,
  `areas_for_improvement` TEXT DEFAULT NULL,
  `parent_comments` TEXT DEFAULT NULL,
  `rating` TINYINT(1) UNSIGNED DEFAULT NULL,
  `consent_to_publish` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  `admin_notes` TEXT DEFAULT NULL,
  `reviewed_by` INT(11) DEFAULT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  KEY `idx_review_status` (`status`),
  KEY `idx_review_student` (`student_id`),
  KEY `idx_review_course` (`course_id`),
  KEY `idx_review_date` (`created_at`),
  CONSTRAINT `fk_review_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_admin` FOREIGN KEY (`reviewed_by`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Populate existing approved registrations into enrollments if not already present
INSERT IGNORE INTO `enrollments` (`student_id`, `course_id`, `registration_id`, `status`, `enrolled_at`)
SELECT r.student_id, rc.course_id, r.registration_id, 'Active', r.created_at
FROM registrations r
JOIN registration_courses rc ON r.registration_id = rc.registration_id
WHERE r.status = 'Approved' AND r.student_id IS NOT NULL;
