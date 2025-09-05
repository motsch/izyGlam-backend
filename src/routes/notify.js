// src/routes/notify.js
const express = require('express');
const router = express.Router();
const admin = require('../lib/firebaseAdmin');
const authMiddleware = require('../middlewares/authMiddleware');
const DeviceToken = require('../models/DeviceToken');
const { sendToUser } = require('../services/notify');

const messaging = admin.messaging();

const adminOnly = (req, res, next) =>
  (req.user && (req.user.role === 'admin' || req.user.isAdmin)) ? next() :
  res.status(403).json({ message: 'Admins only' });

// Envoi direct à 1 token (tool d’admin)
router.post('/by-token', authMiddleware, adminOnly, async (req, res) => {
  const { token, title = 'Hello 👋', body = 'Test direct token', data = {} } = req.body || {};
  if (!token) return res.status(400).json({ message: 'token required' });

  try {
    const r = await messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    res.json({ ok: true, messageId: r });
  } catch (e) {
    console.error('FCM by-token error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Envoi au user (tool d’admin utilisant la DB)
router.post('/test', authMiddleware, adminOnly, async (req, res) => {
  const { userId, title = 'Hello 👋', body = 'Test via user', data = {} } = req.body || {};
  if (!userId) return res.status(400).json({ message: 'userId required' });

  try {
    const result = await sendToUser(userId, { notification: { title, body }, data });
    res.json(result);
  } catch (e) {
    console.error('FCM by-user error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
