// src/models/Lamp.js
const mongoose = require('mongoose');

const lampSchema = new mongoose.Schema({
  gw_id: { type: String, required: true },
  node_id: { type: String, required: true, unique: true },
  lamp_state: { type: String, default: 'OFF' }, // 'ON' or 'OFF'
  lamp_dim: { type: Number, default: 50 }, // 0-100
  lux: { type: Number, default: 0 },
  current_a: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Cập nhật updatedAt mỗi khi save
lampSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Lamp', lampSchema);