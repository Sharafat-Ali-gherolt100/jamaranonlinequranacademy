-- =============================================================
-- Migration 002 — Add publication fields to parent_reviews
-- Jamaran Online Quran Academy
--
-- Purpose:
--   Adds a dedicated is_published flag and published_at timestamp
--   to parent_reviews so an admin can explicitly Publish or
--   Unpublish a review independently of the Approved/Rejected
--   approval workflow.
--
-- Safety:
--   • Uses ALTER TABLE … ADD COLUMN IF NOT EXISTS (MySQL 8.0+
--     compatible). If your MySQL version is older the IF NOT
--     EXISTS clause on ADD COLUMN is not supported — remove it
--     and only run this migration once.
--   • No existing rows are deleted or modified.
--   • New rows default to is_published = 0 (unpublished).
-- =============================================================

ALTER TABLE `parent_reviews`
    ADD COLUMN IF NOT EXISTS `is_published`  TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Admin-controlled publication flag. 1 = visible on public website.'
        AFTER `consent_to_publish`,

    ADD COLUMN IF NOT EXISTS `published_at`  TIMESTAMP NULL DEFAULT NULL
        COMMENT 'Timestamp of most recent Publish action by an admin.'
        AFTER `is_published`;

-- Add an index to speed up the public API query
-- (status + consent_to_publish + is_published are all used in the WHERE clause)
ALTER TABLE `parent_reviews`
    ADD INDEX IF NOT EXISTS `idx_review_published` (`status`, `consent_to_publish`, `is_published`);

-- Verify the columns were added
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    EXTRA,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'parent_reviews'
  AND COLUMN_NAME IN ('is_published', 'published_at')
ORDER BY ORDINAL_POSITION;
