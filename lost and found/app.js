/**
 * Lost and Found Application
 * A web application for reporting and claiming lost and found items
 */

// Dependencies
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');

// Constants
const PORT = 3000;
const UPLOAD_DIR = 'public/uploads/';

// Initialize Express app
const app = express();

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

// Middleware Setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, email, full_name, contact_number, password } = req.body;

  // Check if password is already used by another user
  db.query('SELECT password FROM users', async (err, results) => {
    if (err) throw err;

    // Check if the new password matches any existing hashed password
    for (const user of results) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        return res.render('register', { error: 'password_used' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, email, full_name, contact_number, password) VALUES (?, ?, ?, ?, ?)', [username, email, full_name, contact_number, hashedPassword], (err) => {
      if (err) throw err;
      res.redirect('/login');
    });
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      const isValid = await bcrypt.compare(password, results[0].password);
      if (isValid) {
        req.session.userId = results[0].id;
        res.redirect('/dashboard');
      } else {
        res.send('Invalid credentials');
      }
    } else {
      res.send('User not found');
    }
  });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { category } = req.query;

  // Check if user is admin
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';

    let query = 'SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id';
    let params = [];
    let conditions = [];

    // Handle category filter
    if (category && category !== 'all') {
      conditions.push('items.category = ?');
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    db.query(query, params, (err, results) => {
      if (err) throw err;

      if (isAdmin) {
        // Calculate stats for admin
        db.query('SELECT COUNT(*) as lost FROM items WHERE type = "lost" AND status = "available"', (err, lostResults) => {
          if (err) throw err;
          db.query('SELECT COUNT(*) as found FROM items WHERE type = "found" AND status = "available"', (err, foundResults) => {
            if (err) throw err;
            db.query('SELECT COUNT(*) as claimed FROM items WHERE status = "claimed"', (err, claimedResults) => {
              if (err) throw err;
              const stats = {
                lost: lostResults[0].lost,
                found: foundResults[0].found,
                claimed: claimedResults[0].claimed
              };
              res.render('dashboard', {
                items: results,
                userId: req.session.userId,
                selectedCategory: category || 'all',
                isAdmin: true,
                stats: stats
              });
            });
          });
        });
      } else {
        res.render('dashboard', {
          items: results,
          userId: req.session.userId,
          selectedCategory: category || 'all',
          isAdmin: false
        });
      }
    });
  });
});

app.get('/lost-items', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { category } = req.query;

  // Check if user is admin
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';

    let query = 'SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id WHERE items.type = ? AND items.status != ?';
    let params = ['lost', 'claimed'];

    // Handle category filter
    if (category && category !== 'all') {
      query += ' AND items.category = ?';
      params.push(category);
    }

    db.query(query, params, (err, results) => {
      if (err) throw err;
      res.render('lost-items', { items: results, userId: req.session.userId, selectedCategory: category || 'all', isAdmin });
    });
  });
});

app.get('/found-items', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { category } = req.query;

  // Check if user is admin
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';

    let query = 'SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id WHERE items.type = ? AND items.status != ?';
    let params = ['found', 'claimed'];

    // Handle category filter
    if (category && category !== 'all') {
      query += ' AND items.category = ?';
      params.push(category);
    }

    db.query(query, params, (err, results) => {
      if (err) throw err;
      res.render('found-items', { items: results, userId: req.session.userId, selectedCategory: category || 'all', isAdmin });
    });
  });
});

app.get('/claimed-items', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { category } = req.query;
  let query = 'SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id WHERE items.status = ?';
  let params = ['claimed'];

  // Handle category filter
  if (category && category !== 'all') {
    query += ' AND items.category = ?';
    params.push(category);
  }

  db.query(query, params, (err, results) => {
    if (err) throw err;
    res.render('claimed-items', { items: results, userId: req.session.userId, selectedCategory: category || 'all' });
  });
});

app.get('/profile', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    db.query('SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id WHERE items.user_id = ? ORDER BY items.created_at DESC', [req.session.userId], (err, itemResults) => {
      if (err) throw err;
      res.render('profile', { user: userResults[0], items: itemResults, isOwnProfile: true });
    });
  });
});

app.get('/profile/:id', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const userId = req.params.id;
  db.query('SELECT id, username, email, full_name, contact_number, profile_picture, created_at FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.send('User not found');
    }
    const isOwnProfile = results[0].id === req.session.userId;
    res.render('profile', { user: results[0], isOwnProfile });
  });
});

app.post('/profile', upload.single('profile_picture'), async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { username, email, full_name, contact_number, password } = req.body;
  const profilePicture = req.file ? req.file.filename : null;

  let updateFields = 'username = ?, email = ?, full_name = ?, contact_number = ?';
  let params = [username, email, full_name, contact_number];

  if (profilePicture) {
    updateFields += ', profile_picture = ?';
    params.push(profilePicture);
  }

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updateFields += ', password = ?';
    params.push(hashedPassword);
  }

  params.push(req.session.userId);

  db.query(`UPDATE users SET ${updateFields} WHERE id = ?`, params, (err) => {
    if (err) throw err;
    res.redirect('/profile');
  });
});

app.get('/add-item', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('add-item');
});

app.post('/add-item', upload.single('image'), (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { type, description, category, location, lost_found_date } = req.body;
  const image = req.file ? req.file.filename : null;
  db.query('INSERT INTO items (user_id, type, description, category, location, image, lost_found_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.session.userId, type, description, category, location, image, lost_found_date], (err) => {
    if (err) throw err;
    // Redirect to appropriate dedicated page based on item type
    const redirectUrl = type === 'lost' ? '/lost-items' : '/found-items';
    res.redirect(redirectUrl);
  });
});

app.get('/search', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { query } = req.query;
  db.query('SELECT items.*, COALESCE(users.full_name, users.username) AS poster_name FROM items JOIN users ON items.user_id = users.id WHERE description LIKE ? OR category LIKE ?', [`%${query}%`, `%${query}%`], (err, results) => {
    if (err) throw err;
    const itemsWithComments = results.map(item => ({ ...item, comments: [] }));
    if (results.length > 0) {
      const itemIds = results.map(item => item.id);
      db.query('SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE item_id IN (?) ORDER BY created_at DESC', [itemIds], (err, commentResults) => {
        if (err) throw err;
        const commentsByItem = {};
        commentResults.forEach(comment => {
          if (!commentsByItem[comment.item_id]) commentsByItem[comment.item_id] = [];
          commentsByItem[comment.item_id].push(comment);
        });
        itemsWithComments.forEach(item => item.comments = commentsByItem[item.id] || []);
        res.render('search', { items: itemsWithComments, query, userId: req.session.userId });
      });
    } else {
      res.render('search', { items: itemsWithComments, query, userId: req.session.userId });
    }
  });
});

app.get('/item/:id', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const itemId = req.params.id;
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';
    db.query('SELECT items.*, COALESCE(poster.full_name, poster.username) AS poster_name, COALESCE(claimer.full_name, claimer.username) AS claimer_name, poster.contact_number FROM items JOIN users poster ON items.user_id = poster.id LEFT JOIN users claimer ON items.claimed_by = claimer.id WHERE items.id = ?', [itemId], (err, itemResults) => {
      if (err) throw err;
      db.query('SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE item_id = ? ORDER BY created_at DESC', [itemId], (err, commentResults) => {
        if (err) throw err;
        res.render('item', { item: itemResults[0], comments: commentResults, userId: req.session.userId, isAdmin });
      });
    });
  });
});

app.post('/item/:id/comment', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const itemId = req.params.id;
  const { comment } = req.body;
  db.query('INSERT INTO comments (item_id, user_id, comment) VALUES (?, ?, ?)', [itemId, req.session.userId, comment], (err) => {
    if (err) throw err;
    res.redirect(`/item/${itemId}`);
  });
});

app.post('/item/:id/claim', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const itemId = req.params.id;
  const { student_name, contact_number } = req.body;
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';
    db.query('SELECT * FROM items WHERE id = ?', [itemId], (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        const item = results[0];
        if (isAdmin) {
          // Admin must provide student name and contact number
          if (!student_name || student_name.trim() === '') {
            return res.send('Please provide the student name who claimed this item.');
          }
          if (!contact_number || contact_number.trim() === '') {
            return res.send('Please provide the contact number of the person who claimed this item.');
          }
          db.query('UPDATE items SET status = "claimed", claimed_by = ?, claimed_student_name = ?, claimed_contact_number = ?, claimed_at = NOW() WHERE id = ?', [req.session.userId, student_name.trim(), contact_number.trim(), itemId], (err) => {
            if (err) throw err;
            res.redirect(`/item/${itemId}`);
          });
        } else if (item.type === 'lost' && item.status === 'available' && item.user_id !== req.session.userId) {
          // Regular user claiming a lost item
          db.query('UPDATE items SET status = "claimed", claimed_by = ? WHERE id = ?', [req.session.userId, itemId], (err) => {
            if (err) throw err;
            res.redirect(`/item/${itemId}`);
          });
        } else if (item.type === 'found' && item.status === 'available' && item.user_id === req.session.userId) {
          // Poster of found item trying to mark as claimed
          res.send('The item hasn\'t been claimed by the owner yet.');
        } else {
          res.send('Item not available for claiming');
        }
      } else {
        res.send('Item not found');
      }
    });
  });
});

app.post('/item/:id/mark-found', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const itemId = req.params.id;
  db.query('SELECT * FROM items WHERE id = ? AND user_id = ? AND type = "found" AND status = "claimed"', [itemId, req.session.userId], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      db.query('UPDATE items SET status = "found" WHERE id = ?', [itemId], (err) => {
        if (err) throw err;
        res.redirect(`/item/${itemId}`);
      });
    } else {
      res.send('You can only mark your own found items as found');
    }
  });
});

app.post('/comment', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { item_id, comment } = req.body;
  db.query('INSERT INTO comments (item_id, user_id, comment) VALUES (?, ?, ?)', [item_id, req.session.userId, comment], (err) => {
    if (err) throw err;
    res.redirect('/dashboard');
  });
});

app.post('/item/:id/delete', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const itemId = req.params.id;
  db.query('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userResults) => {
    if (err) throw err;
    const isAdmin = userResults[0].username === 'admin';
    if (isAdmin) {
      // Admin can delete any item
      db.query('DELETE FROM comments WHERE item_id = ?', [itemId], (err) => {
        if (err) throw err;
        db.query('DELETE FROM items WHERE id = ?', [itemId], (err) => {
          if (err) throw err;
          res.redirect('/dashboard');
        });
      });
    } else {
      // Regular users can only delete their own items
      db.query('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, req.session.userId], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
          db.query('DELETE FROM comments WHERE item_id = ?', [itemId], (err) => {
            if (err) throw err;
            db.query('DELETE FROM items WHERE id = ?', [itemId], (err) => {
              if (err) throw err;
              res.redirect('/dashboard');
            });
          });
        } else {
          res.send('You can only delete your own items');
        }
      });
    }
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
