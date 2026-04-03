import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';
import { sendOTP } from '../services/emailService';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  // Check if DB is connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection failed. Please log into MongoDB Atlas and whitelist your current IP address.' 
    });
  }

  let { name, email, password, role, vehicleNumber } = req.body;
  if (typeof email === 'string') {
    email = email.toLowerCase().trim();
  }

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user object
    user = new User({
      name,
      email,
      password,
      role: role || 'traveller',
      vehicleNumber,
      isVerified: false,
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save user to database
    await user.save();

    // Send OTP email
    await sendOTP(email, otp);

    res.json({ success: true, requireOtp: true, message: 'OTP sent to email. Please verify to complete registration.' });
  } catch (err: any) {
    console.error('Registration Error:', err.message || err);
    res.status(500).json({ success: false, message: `Server error: ${err.message || 'Unknown error'}` });
  }
});

// Verify Registration OTP
router.post('/verify-registration', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'User already verified' });

    if (user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Valid OTP
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';

    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '7d' },
      (err: Error | null, token: string | undefined) => {
        if (err) throw err;
        const userWithoutPassword = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: (user as any).phone || '',
          vehicleNumber: user.vehicleNumber
        };
        
        res.json({ success: true, token, user: userWithoutPassword });
      }
    );
  } catch (err: any) {
    console.error('Verify OTP Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  let { email, password } = req.body;
  if (typeof email === 'string') {
    email = email.toLowerCase().trim();
  }

  // Hardcoded Admin Login
  if (email === 'admin@nhms.com' && password === 'admin123') {
    return res.json({
      success: true,
      token: 'admin-mock-token-xyz',
      user: {
        id: 'admin_001',
        name: 'System Administrator',
        email: 'admin@nhms.com',
        role: 'admin',
        vehicleNumber: 'ADMIN-001'
      }
    });
  }

  // Check if DB is connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection failed. Please log into MongoDB Atlas and whitelist your current IP address.' 
    });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. Please try again.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. Please try again.' });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';

    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '7d' },
      (err: Error | null, token: string | undefined) => {
        if (err) throw err;
        const userWithoutPassword = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: (user as any).phone || '',
          vehicleNumber: user.vehicleNumber
        };
        res.json({ success: true, token, user: userWithoutPassword });
      }
    );
  } catch (err: any) {
    console.error('Login Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Get all users
router.get('/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
       return res.status(500).json({ success: false, message: 'DB not connected' });
    }
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err: any) {
    console.error('Fetch Users Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user profile
router.put('/profile/:id', async (req, res) => {
  try {
    const { name, email, phone, vehicleNumber } = req.body;
    
    // Handle mock admin user
    if (req.params.id === 'admin_001') {
      return res.json({
        success: true, 
        user: {
          id: 'admin_001',
          name: name || 'System Administrator',
          email: email || 'admin@nhms.com',
          role: 'admin',
          phone: phone || '',
          vehicleNumber: vehicleNumber || 'ADMIN-001'
        }
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (typeof email === 'string' && email.trim() !== '') {
      updateData.email = email.toLowerCase().trim();
    } else if (email) {
      updateData.email = email;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (vehicleNumber !== undefined) updateData.vehicleNumber = vehicleNumber;
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.json({ success: true, user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: (user as any).phone || '',
      vehicleNumber: user.vehicleNumber
    }});
  } catch (err: any) {
    console.error('Update Profile Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Delete User Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Edit user (role, name, vehicle)
router.put('/users/:id', async (req, res) => {
  try {
    const { name, role, vehicleNumber } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (vehicleNumber !== undefined) updateData.vehicleNumber = vehicleNumber;
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err: any) {
    console.error('Edit User Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
