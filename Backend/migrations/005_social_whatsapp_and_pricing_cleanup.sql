-- =============================================================
-- Migration 005 — Social links, central WhatsApp & pricing cleanup
-- Jamaran Online Quran Academy
--
-- Purpose
--   1. Ensure every social platform used by the public footer has a
--      single editable setting in site_settings (including LinkedIn).
--   2. Ensure the central WhatsApp number / link settings exist.
--   3. Keep the legacy courses.monthly_fee column in place (data is
--      preserved) but stop exposing or accepting it through the API.
--      No destructive column drop is performed.
--
-- Safety
--   • Additive only. Existing values are never overwritten.
--   • INSERT ... ON DUPLICATE KEY UPDATE keeps admin edits intact.
--   • Re-running this file is safe.
-- =============================================================

-- 1. Social platform URLs (empty by default so icons stay hidden
--    until an admin enters a URL).
INSERT INTO `site_settings`
  (`setting_key`, `setting_value`, `setting_group`, `label`, `field_type`, `sort_order`) VALUES
  ('social_facebook',  '', 'contact', 'Facebook URL',  'url', 97),
  ('social_youtube',   '', 'contact', 'YouTube URL',   'url', 98),
  ('social_instagram', '', 'contact', 'Instagram URL', 'url', 99),
  ('social_linkedin',  '', 'contact', 'LinkedIn URL',  'url', 100)
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- 2. Central WhatsApp number and link. The number is the single
--    source of truth; the server derives the wa.me link from it.
INSERT INTO `site_settings`
  (`setting_key`, `setting_value`, `setting_group`, `label`, `field_type`, `sort_order`) VALUES
  ('contact_whatsapp',      '+92 349 1894299', 'contact', 'WhatsApp Number', 'text', 91),
  ('contact_whatsapp_link', 'https://wa.me/923491894299', 'contact', 'WhatsApp Link (auto-generated from number)', 'url', 92)
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- 3. Keep sort order tidy for the contact group.
UPDATE `site_settings`
SET `sort_order` = CASE `setting_key`
    WHEN 'contact_phone'          THEN 90
    WHEN 'contact_whatsapp'       THEN 91
    WHEN 'contact_whatsapp_link'  THEN 92
    WHEN 'contact_email'          THEN 93
    WHEN 'contact_address'        THEN 94
    WHEN 'contact_hours'          THEN 95
    WHEN 'contact_languages'      THEN 96
    WHEN 'social_facebook'        THEN 97
    WHEN 'social_youtube'         THEN 98
    WHEN 'social_instagram'       THEN 99
    WHEN 'social_linkedin'        THEN 100
    ELSE `sort_order`
  END
WHERE `setting_key` IN (
    'contact_phone', 'contact_whatsapp', 'contact_whatsapp_link',
    'contact_email', 'contact_address', 'contact_hours', 'contact_languages',
    'social_facebook', 'social_youtube', 'social_instagram', 'social_linkedin'
);

-- 4. Verification helper (informational only)
SELECT `setting_key`, `setting_value`
FROM `site_settings`
WHERE `setting_group` = 'contact'
ORDER BY `sort_order` ASC;
