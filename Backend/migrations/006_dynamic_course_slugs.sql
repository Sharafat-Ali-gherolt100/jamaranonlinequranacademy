-- =============================================================
-- Migration 006 — Dynamic Course Slugs & Rich Metadata
-- Jamaran Online Quran Academy
-- =============================================================

ALTER TABLE `courses` ADD COLUMN IF NOT EXISTS `syllabus` TEXT DEFAULT NULL AFTER `duration`;
ALTER TABLE `courses` ADD COLUMN IF NOT EXISTS `instructor` VARCHAR(150) DEFAULT NULL AFTER `syllabus`;
ALTER TABLE `courses` ADD COLUMN IF NOT EXISTS `requirements` TEXT DEFAULT NULL AFTER `instructor`;
ALTER TABLE `courses` ADD COLUMN IF NOT EXISTS `category` VARCHAR(100) DEFAULT NULL AFTER `requirements`;
