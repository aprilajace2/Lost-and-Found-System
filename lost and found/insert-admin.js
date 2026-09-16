const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Database Configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Default XAMPP password
  database: 'lostandfound'
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
  console.log('Connected to MySQL database');
});

// Create admin user
async function createAdmin() {
  const username = 'admin';
  const email = 'admin@example.com';
  const full_name = 'Administrator';
  const year_level = 'N/A';
  const section = 'Admin';
  const password = 'admin';

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert admin user
  db.query('INSERT INTO users (username, email, full_name, year_level, section, password) VALUES (?, ?, ?, ?, ?, ?)', 
    [username, email, full_name, year_level, section, hashedPassword], (err) => {
    if (err) {
      console.error('Error inserting admin user:', err);
      throw err;
    }
    console.log('Admin user created successfully');
    db.end();
  });
}

createAdmin();
