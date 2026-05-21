-- SCMS Database Schema

CREATE DATABASE IF NOT EXISTS scms_db;
USE scms_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(20) PRIMARY KEY,
    student_id INT,
    student_name VARCHAR(100),
    student_email VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    status ENUM('Pending', 'In Progress', 'Resolved') DEFAULT 'Pending',
    attached_file VARCHAR(255),
    admin_reply TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications Table (Optional but good for tracking)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed Admin User (Password: admin123)
-- Hash generated via bcrypt: $2b$12$8K5Y/6Jq.6Y8xY8xY8xY8e8K5Y/6Jq.6Y8xY8xY8xY8e (Example)
-- In production, hashing should be done via script.
INSERT IGNORE INTO users (name, email, password, role) 
VALUES ('System Admin', 'admin@scms.edu', '$2b$12$K7v1b1b1b1b1b1b1b1b1b1u7K7v1b1b1b1b1b1b1b1b1b1u7', 'admin');
