import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';

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

  const { name, email, password, role, vehicleNumber } = req.body;

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
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user to database
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
        // Return without password
        const userWithoutPassword = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          vehicleNumber: user.vehicleNumber
        };
        
        res.json({ success: true, token, user: userWithoutPassword });
      }
    );
  } catch (err: any) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  // Check if DB is connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection failed. Please log into MongoDB Atlas and whitelist your current IP address.' 
    });
  }

  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. Please try again.' });
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

export default router;
