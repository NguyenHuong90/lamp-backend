const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs'); // Thêm bcrypt để mã hóa mật khẩu
const User = require('./src/models/User'); // Import model User

dotenv.config();
const app = express();

// Thêm middleware logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

app.use(helmet());
const allowedOrigins = ['http://localhost:3000', 'http://192.168.56.1:3000'];
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB connected');

    // Tạo tài khoản admin mặc định
    await createDefaultAdmin();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Hàm tạo tài khoản admin mặc định
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10); // Mật khẩu mặc định: admin123
      const admin = new User({
        username: 'admin',
        password: hashedPassword,
        role: 'admin', // Đảm bảo role là admin
        createdAt: new Date()
      });
      await admin.save();
      console.log('Default admin account created: username=admin, password=admin123');
    } else {
      console.log('Admin account already exists');
    }
  } catch (err) {
    console.error('Error creating default admin account:', err.message);
  }
};

connectDB();

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/lamp', require('./src/routes/lamp'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));