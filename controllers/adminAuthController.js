const jwt = require('jsonwebtoken');
const User = require('../models/Admin');
const bcryptjs = require("bcryptjs");

const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

exports.register = async (req, res) => {
  try {
    const { name, avatar, phone, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, avatar, email, phone, password });
    const token = generateToken(user);
    user.refreshedToken = token;
    await user.save();

    res.status(201).json({ user: { name: user.name, email: user.email, phone: user.phone }, token });
  } catch (err) {
    res.status(500).json({ message: "Auth Error: "+err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const accessToken = generateToken(user);
  const refreshToken = generateToken(user);

  user.refreshedToken = refreshToken;
  await user.save();

  res.json({ user: { 
    name: user.name,
    email: user.email,
    phone: user.phone
  }, accessToken });
};

exports.logout = async (req, res) => {
  const { token } = req.body; // This is the refresh token

  if (!token) {
    return res.status(400).json({ message: 'No token provided' });
  }

  try {
    const user = await User.findOne({ refreshedToken: token });

    if (!user) {
      return res.status(204).json({ message: 'Already logged out' }); // No content
    }

    user.refreshedToken = null;
    await user.save();

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Logout failed', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: 'User not found' });

    // Generate token
    const token = generateToken(user);
    const expires = Date.now() + 1000 * 60 * 15; // 15 minutes

    // Save to DB
    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    // Build reset link
    // const resetLink = `http://127.0.0.1:3000/reset-password/${token}`;

    // // Send Email (simplified)
    // const transporter = nodemailer.createTransport({
    //   service: 'Gmail',
    //   auth: {
    //     user: process.env.EMAIL_FROM,
    //     pass: process.env.EMAIL_PASS,
    //   }
    // });

    // await transporter.sendMail({
    //   to: user.email,
    //   from: process.env.EMAIL_FROM,
    //   subject: 'Password Reset Request',
    //   html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
    // });

    res.status(200).json({ message: 'Reset link sent to email' });

  } catch (err) {
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // still valid
    });

    if (!user) {
      return res.status(400).json({ message: 'Token invalid or expired' });
    }

    // Set new password
    user.password = newPassword;

    // Invalidate token
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });

  } catch (err) {
    res.status(500).json({ message: 'Reset failed', error: err.message });
  }
};

