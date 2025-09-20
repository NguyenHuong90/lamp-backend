const express = require('express');
const router = express.Router();
const Lamp = require('../models/Lamp');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../models/ActivityLog');
const mqtt = require('mqtt');

// Kết nối MQTT broker
const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883', {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
});

mqttClient.on('connect', () => {
  console.log('MQTT connected');
});

mqttClient.on('error', (err) => {
  console.error('MQTT error:', err);
});

// Middleware để kiểm tra JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET /api/lamp/state - Lấy tất cả trạng thái đèn
router.get('/state', verifyToken, async (req, res) => {
  try {
    const lamps = await Lamp.find({});
    res.json(lamps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lamp/control - Thêm hoặc cập nhật đèn
router.post('/control', verifyToken, async (req, res) => {
  const { gw_id, node_id, lamp_state, lamp_dim, lux, current_a } = req.body;
  try {
    let lamp = await Lamp.findOne({ node_id });
    if (lamp) {
      // Cập nhật đèn tồn tại
      if (lamp_state !== undefined) lamp.lamp_state = lamp_state;
      if (lamp_dim !== undefined) lamp.lamp_dim = lamp_dim;
      if (lux !== undefined) lamp.lux = lux;
      if (current_a !== undefined) lamp.current_a = current_a;
      await lamp.save();
    } else {
      // Thêm đèn mới
      lamp = new Lamp({ gw_id, node_id, lamp_state, lamp_dim, lux, current_a });
      await lamp.save();
    }

    // Log hoạt động
    await new ActivityLog({
      userId: req.user.id,
      action: lamp ? 'update_lamp' : 'add_lamp',
      details: { node_id },
      ip: req.ip,
      timestamp: new Date()
    }).save();

    // Publish MQTT đến gateway (node_id là số để khớp với LoRa dest_addr)
    const nodeIdNum = parseInt(node_id) || 2; // Default to 2 (SLAVE_ADDRESS) if invalid
    const payload = { lamp_state: lamp.lamp_state, lamp_dim: lamp.lamp_dim };
    mqttClient.publish(`lamp/control/${nodeIdNum}`, JSON.stringify(payload));
    console.log(`Published to MQTT: lamp/control/${nodeIdNum} - ${JSON.stringify(payload)}`);

    res.json({ lamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/lamp/delete - Xóa đèn
router.delete('/delete', verifyToken, async (req, res) => {
  const { gw_id, node_id } = req.body;
  try {
    const lamp = await Lamp.findOneAndDelete({ gw_id, node_id });
    if (!lamp) return res.status(404).json({ message: 'Lamp not found' });

    // Log hoạt động
    await new ActivityLog({
      userId: req.user.id,
      action: 'delete_lamp',
      details: { node_id },
      ip: req.ip,
      timestamp: new Date()
    }).save();

    // Publish MQTT để tắt đèn trước khi xóa
    const nodeIdNum = parseInt(node_id) || 2;
    const payload = { lamp_state: 'OFF', lamp_dim: 0 };
    mqttClient.publish(`lamp/control/${nodeIdNum}`, JSON.stringify(payload));
    console.log(`Published delete to MQTT: lamp/control/${nodeIdNum} - ${JSON.stringify(payload)}`);

    res.json({ message: 'Lamp deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;