-- =============================================================
-- Migration 004 — Additional site settings and schema fixes
-- Jamaran Online Quran Academy
--
-- Purpose
--   1. Adds founder_message_2 setting for the About page
--   2. Adds reviewed_by FK to parent_reviews if not present
--   3. Ensures published_at column exists on parent_reviews
--   4. Adds is_published default for existing reviews
--   5. Safe — additive only, never overwrites existing data
-- =============================================================

-- 1. Add founder_message_2 to site_settings
INSERT INTO `site_settings`
  (`setting_key`, `setting_value`, `setting_group`, `label`, `field_type`, `sort_order`) VALUES
  ('founder_message_2',
   'Through Jamaran Online Quran Academy, we aim to provide a supportive learning environment where students can develop a stronger connection with the Holy Quran and Islamic teachings.',
   'about', 'Founder Second Paragraph', 'textarea', 84)
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- 2. Ensure is_published column exists on parent_reviews
ALTER TABLE `parent_reviews`
    ADD COLUMN IF NOT EXISTS `is_published` TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Set to 1 only by an admin after approval and consent check',
    ADD COLUMN IF NOT EXISTS `published_at` DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `reviewed_by`  INT(11)   DEFAULT NULL
        COMMENT 'admin_id who last reviewed this record',
    ADD COLUMN IF NOT EXISTS `reviewed_at`  DATETIME  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `admin_notes`  TEXT      DEFAULT NULL;

-- 3. Set default is_published = 0 for any NULL rows
UPDATE `parent_reviews`
SET `is_published` = 0
WHERE `is_published` IS NULL;

-- 4. Make sure students table has an email column (in case migration ran before schema was created)
ALTER TABLE `students`
    ADD COLUMN IF NOT EXISTS `email` VARCHAR(150) DEFAULT NULL AFTER `name`;

-- 5. Verify
SELECT 'Migration 004 completed successfully' AS result;
