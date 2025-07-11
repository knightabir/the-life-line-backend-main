const express = require('express');
const router = express.Router();


const authController = require('../controllers/adminAuthController');
const authMiddleware = require('../middlewares/adminAuthMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;