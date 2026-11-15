-- =============================================================
-- Migration 000 — Full base schema
-- Jamaran Online Quran Academy
-- Run this FIRST on a fresh database.
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- =============================================================

-- 1. ADMINS
CREATE TABLE IF NOT EXISTS `admins` (
  `admin_id`      INT(11) NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(80)  NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `unique_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. TEACHERS
CREATE TABLE IF NOT EXISTS `teachers` (
  `teacher_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `name`             VARCHAR(100) NOT NULL,
  `email`            VARCHAR(150) DEFAULT NULL,
  `whatsapp`         VARCHAR(25)  DEFAULT NULL,
  `gender`           ENUM('Male','Female') NOT NULL DEFAULT 'Male',
  `country`          VARCHAR(100) DEFAULT NULL,
  `qualification`    VARCHAR(150) DEFAULT NULL,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`teacher_id`),
  UNIQUE KEY `unique_teacher_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. COURSES
CREATE TABLE IF NOT EXISTS `courses` (
  `course_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `course_name`  VARCHAR(100) NOT NULL,
  `description`  TEXT         DEFAULT NULL,
  `monthly_fee`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `is_active`    TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `unique_course_name` (`course_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. STUDENTS
CREATE TABLE IF NOT EXISTS `students` (
  `student_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL,
  `email`        VARCHAR(150) DEFAULT NULL,
  `country`      VARCHAR(100) NOT NULL,
  `country_code` VARCHAR(10)  NOT NULL DEFAULT '+92',
  `whatsapp`     VARCHAR(25)  NOT NULL,
  `gender`       ENUM('Male','Female') NOT NULL,
  `age`          TINYINT(3) UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. REGISTRATIONS
CREATE TABLE IF NOT EXISTS `registrations` (
  `registration_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `student_id`         INT(11) DEFAULT NULL,
  `teacher_id`         INT(11) DEFAULT NULL,
  `name`               VARCHAR(100) NOT NULL,
  `email`              VARCHAR(150) DEFAULT NULL,
  `country`            VARCHAR(100) NOT NULL,
  `country_code`       VARCHAR(10)  NOT NULL DEFAULT '+92',
  `whatsapp`           VARCHAR(25)  NOT NULL,
  `gender`             ENUM('Male','Female') NOT NULL,
  `age`                TINYINT(3) UNSIGNED NOT NULL DEFAULT 0,
  `teacher_preference` ENUM('Male','Female','Any') NOT NULL DEFAULT 'Any',
  `preferred_timing`   ENUM('Morning','Afternoon','Evening','Night') NOT NULL DEFAULT 'Evening',
  `message`            TEXT DEFAULT NULL,
  `status`             ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `reviewed_at`        TIMESTAMP NULL DEFAULT NULL,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`registration_id`),
  KEY `idx_reg_status`   (`status`),
  KEY `idx_reg_student`  (`student_id`),
  KEY `idx_reg_teacher`  (`teacher_id`),
  CONSTRAINT `fk_reg_student` FOREIGN KEY (`student_id`) REFERENCES `students`  (`student_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`  (`teacher_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. REGISTRATION_COURSES  (many-to-many: registration ↔ course)
CREATE TABLE IF NOT EXISTS `registration_courses` (
  `id`              INT(11) NOT NULL AUTO_INCREMENT,
  `registration_id` INT(11) NOT NULL,
  `course_id`       INT(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reg_course` (`registration_id`, `course_id`),
  KEY `fk_rc_course` (`course_id`),
  CONSTRAINT `fk_rc_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rc_course`        FOREIGN KEY (`course_id`)       REFERENCES `courses`       (`course_id`)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Seed the 6 default courses
INSERT INTO `courses` (`course_name`, `monthly_fee`, `is_active`) VALUES
  ('Yassarnul Quran',    1500.00, 1),
  ('Quran with Tajweed', 1500.00, 1),
  ('Duas and Ziyarat',   1500.00, 1),
  ('Tafseer',            2000.00, 1),
  ('Nahjul Balagha',     2000.00, 1),
  ('Ahkam e Namaz',      1500.00, 1)
ON DUPLICATE KEY UPDATE `course_name` = `course_name`;

SELECT 'Base schema created successfully.' AS result;
