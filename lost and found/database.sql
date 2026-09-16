-- Lost and Found Database Schema
-- This database stores users, lost/found items, and comments

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS lostandfound;

-- Use the database
USE lostandfound;

-- Users table: stores user account information
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  profile_picture VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items table: stores lost and found item information
CREATE TABLE items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type ENUM('lost', 'found') NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(255),
  location VARCHAR(255),
  image VARCHAR(255),
  lost_found_date DATETIME,
  status ENUM('available', 'claimed') DEFAULT 'available',
  claimed_by INT,
  claimed_student_name VARCHAR(255),
  claimed_contact_number VARCHAR(20),
  claimed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (claimed_by) REFERENCES users(id)
);

-- Comments table: stores comments on items
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT,
  user_id INT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Trigger to prevent deletion of admin user
DELIMITER $$
CREATE TRIGGER prevent_admin_deletion
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
  IF OLD.username = 'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete the admin user.';
  END IF;
END$$
DELIMITER ;

-- Insert built-in admin user (password is 'admin' hashed with bcrypt, salt rounds 10)
INSERT INTO users (username, email, full_name, contact_number, password) VALUES
('admin', 'admin@school.edu', 'Administrator', '09123456789', '$2b$10$xMPcSiJrW/It/kK2Yg.Tu.tW.W.Rp1WsYHz1q6qV3JnfjTX.K/.lK');
