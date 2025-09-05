// src/models/DeviceToken.js
const mongoose = require('mongoose');

let DeviceToken;
try {
  DeviceToken = mongoose.model('DeviceToken');
} catch {
  const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android','ios','web'], required: true },
    lastSeenAt: { type: Date, default: Date.now },
    enabled: { type: Boolean, default: true },
  }, { timestamps: true });

  DeviceToken = mongoose.model('DeviceToken', schema);
}

module.exports = DeviceToken;
