-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: Jamran_academy
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admins` (
  `admin_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `unique_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'admin','$2b$12$lMaTVZWS01bL/oYS.REvN.4YUIojoOrVlhloHI0SnmdZaw7EmCkl2','2026-11-02 18:31:20');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `courses` (
  `course_id` int(11) NOT NULL AUTO_INCREMENT,
  `course_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `slug` varchar(120) DEFAULT NULL,
  `level` varchar(80) DEFAULT NULL,
  `duration` varchar(80) DEFAULT NULL,
  `monthly_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `unique_course_name` (`course_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` VALUES (1,'Yassarnul Quran',NULL,'images/yassarnal quran.png','yassarnul_quran','Foundation Level',NULL,1500.00,1,0,'2026-11-02 18:31:04'),(2,'Quran with Tajweed',NULL,'images/Quran with tarjuma.png','quran_tajweed','Intermediate & Advanced',NULL,1500.00,1,0,'2026-11-02 18:31:04'),(3,'Duas and Ziyarat',NULL,'images/Dua.png','duas_ziyarat','Spiritual Studies',NULL,1500.00,1,0,'2026-11-02 18:31:04'),(4,'Tafseer',NULL,'images/tafseer quran.png','tafseer','Deep Comprehension',NULL,2000.00,1,0,'2026-11-02 18:31:04'),(5,'Nahjul Balagha',NULL,'images/nahjul balagha.png','nahjul_balagha','Wisdom of Imam Ali (AS)',NULL,2000.00,1,0,'2026-11-02 18:31:04'),(6,'Ahkam e Namaz',NULL,'images/namz.png','ahkam_namaz','Practical Jurisprudence',NULL,1500.00,1,0,'2026-11-02 18:31:04');
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `enrollments` (
  `enrollment_id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `registration_id` int(11) DEFAULT NULL,
  `status` enum('Active','Completed','Paused','Cancelled') NOT NULL DEFAULT 'Active',
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `unique_student_course` (`student_id`,`course_id`),
  KEY `fk_enrollment_course` (`course_id`),
  KEY `fk_enrollment_registration` (`registration_id`),
  CONSTRAINT `fk_enrollment_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_enrollment_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enrollments`
--

LOCK TABLES `enrollments` WRITE;
/*!40000 ALTER TABLE `enrollments` DISABLE KEYS */;
/*!40000 ALTER TABLE `enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parent_reviews`
--

DROP TABLE IF EXISTS `parent_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `parent_reviews` (
  `review_id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) DEFAULT NULL,
  `student_name` varchar(100) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `course_name` varchar(100) NOT NULL,
  `parent_name` varchar(100) NOT NULL,
  `relationship` varchar(40) DEFAULT NULL COMMENT 'Reviewer relationship to the student, e.g. Mother, Father, Guardian',
  `parent_email` varchar(150) NOT NULL,
  `parent_phone` varchar(25) DEFAULT NULL,
  `review_date` date NOT NULL DEFAULT curdate(),
  `progress_feedback` text NOT NULL,
  `strengths` text DEFAULT NULL,
  `areas_for_improvement` text DEFAULT NULL,
  `parent_comments` text DEFAULT NULL,
  `rating` tinyint(1) unsigned DEFAULT NULL,
  `consent_to_publish` tinyint(1) NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Admin-controlled publication flag. 1 = visible on public website.',
  `published_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp of most recent Publish action by an admin.',
  `status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `admin_notes` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`review_id`),
  KEY `idx_review_status` (`status`),
  KEY `idx_review_student` (`student_id`),
  KEY `idx_review_course` (`course_id`),
  KEY `idx_review_date` (`created_at`),
  KEY `fk_review_admin` (`reviewed_by`),
  KEY `idx_review_published` (`status`,`consent_to_publish`,`is_published`),
  CONSTRAINT `fk_review_admin` FOREIGN KEY (`reviewed_by`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parent_reviews`
--

LOCK TABLES `parent_reviews` WRITE;
/*!40000 ALTER TABLE `parent_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `parent_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `registration_courses`
--

DROP TABLE IF EXISTS `registration_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `registration_courses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `registration_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reg_course` (`registration_id`,`course_id`),
  KEY `fk_rc_course` (`course_id`),
  CONSTRAINT `fk_rc_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rc_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`registration_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registration_courses`
--

LOCK TABLES `registration_courses` WRITE;
/*!40000 ALTER TABLE `registration_courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `registration_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `registrations`
--

DROP TABLE IF EXISTS `registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `registrations` (
  `registration_id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) DEFAULT NULL,
  `teacher_id` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `country` varchar(100) NOT NULL,
  `country_code` varchar(10) NOT NULL DEFAULT '+92',
  `whatsapp` varchar(25) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `age` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `teacher_preference` enum('Male','Female','Any') NOT NULL DEFAULT 'Any',
  `preferred_timing` enum('Morning','Afternoon','Evening','Night') NOT NULL DEFAULT 'Evening',
  `message` text DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`registration_id`),
  KEY `idx_reg_status` (`status`),
  KEY `idx_reg_student` (`student_id`),
  KEY `idx_reg_teacher` (`teacher_id`),
  CONSTRAINT `fk_reg_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`teacher_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registrations`
--

LOCK TABLES `registrations` WRITE;
/*!40000 ALTER TABLE `registrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `registrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_settings`
--

DROP TABLE IF EXISTS `site_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_settings` (
  `setting_id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_group` varchar(50) NOT NULL DEFAULT 'general',
  `label` varchar(150) DEFAULT NULL,
  `field_type` enum('text','textarea','image','url','html') NOT NULL DEFAULT 'text',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `unique_setting_key` (`setting_key`),
  KEY `idx_setting_group` (`setting_group`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_settings`
--

LOCK TABLES `site_settings` WRITE;
/*!40000 ALTER TABLE `site_settings` DISABLE KEYS */;
INSERT INTO `site_settings` VALUES (1,'hero_heading','Learn with Shia Aalim-e-Deen','homepage','Hero Heading','text',1,'2026-11-02 18:31:04'),(2,'hero_subheading','Learn Quran & Islamic Teachings Online With Qualified Shia Aalim-e-Deen','homepage','Hero Subheading','textarea',2,'2026-11-02 18:31:04'),(3,'hero_highlight','Quran ΓÇó Qaida ΓÇó Nahjul Balagha ΓÇó Ahkam','homepage','Hero Highlight Line','text',3,'2026-11-02 18:31:04'),(4,'hero_image_1','images/Image1.png','homepage','Hero Background Image 1','image',4,'2026-11-02 18:31:04'),(5,'hero_image_2','images/Image2.png','homepage','Hero Background Image 2','image',5,'2026-11-02 18:31:04'),(6,'hero_image_3','images/image3.png','homepage','Hero Background Image 3','image',6,'2026-11-02 18:31:04'),(7,'about_subtitle','ΓÇö Welcome to Our Academy ΓÇö','homepage','About Subtitle','text',10,'2026-11-02 18:31:04'),(8,'about_heading','JAMARAN ONLINE QURAN ACADEMY','homepage','About Heading','text',11,'2026-11-02 18:31:04'),(9,'about_text','Jamaran Online Quran Academy is dedicated to providing quality online Quran education for children and adults. Our aim is to provide simple, reliable, and engaging online education with proper guidance from experienced teachers.','homepage','About Paragraph','textarea',12,'2026-11-02 18:31:04'),(10,'about_image','images/logo (3).png','homepage','Homepage About Image','image',13,'2026-11-02 18:31:04'),(11,'courses_heading','Courses We Offer','homepage','Courses Section Heading','text',20,'2026-11-02 18:31:04'),(12,'courses_subtitle','ΓÇö Our Courses ΓÇö','homepage','Courses Section Subtitle','text',21,'2026-11-02 18:31:04'),(13,'whyus_heading','Why Choose Jamaran Academy?','homepage','Why Choose Us Heading','text',30,'2026-11-02 18:31:04'),(14,'whyus_subtitle','ΓÇö Why Choose Us ΓÇö','homepage','Why Choose Us Subtitle','text',31,'2026-11-02 18:31:04'),(15,'whyus_text','We provide convenient, flexible, and quality online Quran education for students of all ages.','homepage','Why Choose Us Paragraph','textarea',32,'2026-11-02 18:31:04'),(16,'trial_heading','Start Your Quran Learning Journey','homepage','Trial Box Heading','text',40,'2026-11-02 18:31:04'),(17,'trial_text','Join from anywhere ΓÇö Learn at your convenience!','homepage','Trial Box Paragraph','textarea',41,'2026-11-02 18:31:04'),(18,'feedback_heading','What Parents Say About Us','homepage','Testimonials Heading','text',50,'2026-11-02 18:31:04'),(19,'feedback_subtitle','ΓÇö PARENT FEEDBACK ΓÇö','homepage','Testimonials Subtitle','text',51,'2026-11-02 18:31:04'),(20,'feedback_text','We are grateful for the trust and feedback of parents who choose Jamaran Online Quran Academy for their children.','homepage','Testimonials Paragraph','textarea',52,'2026-11-02 18:31:04'),(21,'footer_about_text','Learn the Quran. Understand its teachings. Build a stronger connection with faith.','general','Footer About Text','textarea',60,'2026-11-02 18:31:04'),(22,'about_page_subtitle','ΓÇö ABOUT OUR ACADEMY ΓÇö','about','About Page Subtitle','text',70,'2026-11-02 18:31:04'),(23,'about_page_heading','Learn the Quran with Proper Guidance','about','About Page Heading','text',71,'2026-11-02 18:31:04'),(24,'about_page_text_1','Jamaran Online Quran Academy is dedicated to providing quality online Quran education for children and adults. Our mission is to make Quranic and Islamic education accessible to students from anywhere in the world.','about','About Page Paragraph 1','textarea',72,'2026-11-02 18:31:04'),(25,'about_page_text_2','We provide a comfortable and flexible online learning environment where students can learn according to their individual needs and schedules under the guidance of qualified and experienced teachers.','about','About Page Paragraph 2','textarea',73,'2026-11-02 18:31:04'),(26,'about_page_image','images/uploads/1793701738318-67ace549fe49e085.png','about','About Page Image','image',74,'2026-11-03 10:29:00'),(27,'founder_heading','Meet Our Founder','about','Founder Heading','text',80,'2026-11-02 18:31:04'),(28,'founder_name','Nawazish Ali','about','Founder Name','text',81,'2026-11-02 18:31:04'),(29,'founder_position','Founder & Director','about','Founder Position','text',82,'2026-11-02 18:31:04'),(30,'founder_message','Our goal is to make quality Quranic and Islamic education accessible to everyone, regardless of their location or busy daily schedule. Through Jamaran Online Quran Academy, we aim to provide a supportive learning environment where students can develop a stronger connection with the Holy Quran and Islamic teachings.','about','Founder Message','textarea',83,'2026-11-02 18:31:04'),(31,'founder_image','images/uploads/1793646464842-7dbf706e8e1b652d.png','about','Founder Image','image',84,'2026-11-02 19:07:49'),(32,'contact_phone','+92 349 0892378','contact','Phone Number','text',90,'2026-11-02 18:38:23'),(33,'contact_whatsapp','+92 349 0892378','contact','WhatsApp Number','text',91,'2026-11-02 18:38:23'),(34,'contact_whatsapp_link','https://wa.me/923490892378','contact','WhatsApp Link','url',92,'2026-11-02 18:38:23'),(35,'contact_email','jamaranquran@gmail.com','contact','Email Address','text',93,'2026-11-02 18:38:23'),(36,'contact_address','Pakistan (Lahore)','contact','Address','text',94,'2026-11-02 18:39:19'),(37,'contact_hours','Mon - Sat (9:00 AM - 7:00 PM)','contact','Opening Hours','text',95,'2026-11-02 18:31:04'),(38,'contact_languages','Urdu ΓÇó English ΓÇó Farsi','contact','Languages Offered','text',96,'2026-11-02 18:31:04'),(39,'social_facebook','','contact','Facebook URL','url',97,'2026-11-02 18:31:04'),(40,'social_youtube','','contact','YouTube URL','url',98,'2026-11-02 18:31:04'),(41,'social_instagram','','contact','Instagram URL','url',99,'2026-11-02 18:31:04'),(42,'founder_message_2','Through Jamaran Online Quran Academy, we aim to provide a supportive learning environment where students can develop a stronger connection with the Holy Quran and Islamic teachings.','about','Founder Second Paragraph','textarea',84,'2026-11-02 18:31:04');
/*!40000 ALTER TABLE `site_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_performance`
--

DROP TABLE IF EXISTS `student_performance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `student_performance` (
  `performance_id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `course_id` int(11) DEFAULT NULL,
  `teacher_id` int(11) DEFAULT NULL,
  `assessment_title` varchar(150) NOT NULL,
  `assessment_date` date DEFAULT NULL,
  `score` decimal(6,2) DEFAULT NULL,
  `max_score` decimal(6,2) DEFAULT NULL,
  `attendance_percent` decimal(5,2) DEFAULT NULL,
  `progress_level` enum('Excellent','Very Good','Good','Satisfactory','Needs Improvement') DEFAULT NULL,
  `progress_notes` text DEFAULT NULL,
  `teacher_feedback` text DEFAULT NULL,
  `recorded_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`performance_id`),
  KEY `idx_perf_student` (`student_id`),
  KEY `idx_perf_course` (`course_id`),
  KEY `idx_perf_teacher` (`teacher_id`),
  KEY `fk_perf_admin` (`recorded_by`),
  CONSTRAINT `fk_perf_admin` FOREIGN KEY (`recorded_by`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_perf_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_perf_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_perf_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`teacher_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_performance`
--

LOCK TABLES `student_performance` WRITE;
/*!40000 ALTER TABLE `student_performance` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_performance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `students` (
  `student_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `country` varchar(100) NOT NULL,
  `country_code` varchar(10) NOT NULL DEFAULT '+92',
  `whatsapp` varchar(25) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `age` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teachers`
--

DROP TABLE IF EXISTS `teachers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `teachers` (
  `teacher_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `whatsapp` varchar(25) DEFAULT NULL,
  `gender` enum('Male','Female') NOT NULL DEFAULT 'Male',
  `country` varchar(100) DEFAULT NULL,
  `qualification` varchar(150) DEFAULT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `specialization` varchar(150) DEFAULT NULL,
  `experience_years` varchar(40) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`teacher_id`),
  UNIQUE KEY `unique_teacher_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teachers`
--

LOCK TABLES `teachers` WRITE;
/*!40000 ALTER TABLE `teachers` DISABLE KEYS */;
/*!40000 ALTER TABLE `teachers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-04 19:46:29
