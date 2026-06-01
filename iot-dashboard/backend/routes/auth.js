const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

  const db = getDb();
  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ token, username: user.username, role: user.role });
});

router.post('/register', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sadece admin kullanıcı oluşturabilir' });
  const { username, password, role = 'viewer' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role]);
    res.json({ message: 'Kullanıcı oluşturuldu', username });
  } catch (err) {
    res.status(400).json({ error: 'Bu kullanıcı adı zaten mevcut' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

module.exports = router;
