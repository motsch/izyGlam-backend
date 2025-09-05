const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middlewares/authMiddleware');

// charge pushTest (TS ou JS compilé)
let startForUser;
try { ({ startForUser } = require('../services/pushTest')); }
catch { try { ({ startForUser } = require('../../dist/services/pushTest')); } catch {} }

// Modèle DeviceToken
let DeviceToken;
try { DeviceToken = mongoose.model('DeviceToken'); }
catch {
  const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android','ios','web'], required: true },
    lastSeenAt: { type: Date, default: Date.now },
    enabled: { type: Boolean, default: true },
  }, { timestamps: true });
  DeviceToken = mongoose.model('DeviceToken', schema);
}

// Helper fallback : récupère un userId depuis req ou, si vide, depuis l'Authorization header
function extractUserId(req) {
  if (req.user && (req.user._id || req.user.id)) return req.user._id || req.user.id;
  if (req.userId) return req.userId;

  const auth = req.headers.authorization || '';
  const raw  = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!raw) return null;
  try {
    const d = jwt.decode(raw); // on decode seulement (authMiddleware a déjà verify)
    return d?.userId || d?.sub || d?._id || d?.id || null;
  } catch { return null; }
}

/**
 * POST /api/devices/register
 * Body: { token, platform }
 * Auth: Bearer <JWT>
 */
router.post('/devices/register', authMiddleware, async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    if (!token || !platform) {
      return res.status(400).json({ message: 'token/platform required' });
    }

    const userId = extractUserId(req);
    if (!userId) {
      console.error('[DEVICES] no user in request. auth =', req.headers.authorization);
      return res.status(401).json({ message: 'Unauthorized: user not found in request' });
    }

    console.log('[DEVICES] register hit:', {
      userId: String(userId), platform, token: token.slice(0, 12) + '...'
    });

    await DeviceToken.updateOne(
      { token },
      { $set: { userId, platform, lastSeenAt: new Date(), enabled: true } },
      { upsert: true }
    );

    if (process.env.PUSH_TEST_AUTOSTART === 'true' && typeof startForUser === 'function') {
      try { startForUser(String(userId)); } catch (e) { console.error('pushTest start error:', e); }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('devices/register error:', e);
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
