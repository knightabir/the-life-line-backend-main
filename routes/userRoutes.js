const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/userAuthMiddleware');
const upload = require('../middlewares/multermiddleware');

router.get('/get-user-data', authMiddleware, userController.getUserData);
router.patch('/update-user-data', authMiddleware, userController.updateUser);
router.get('/get-blood-groups', userController.getBloodGroups);
router.post('/update-avatar', authMiddleware, upload.single('avatar'), userController.updateUserAvatar);

router.post('/request-blood', authMiddleware, userController.bloodRecieveRequest);
router.post('/donate-blood', authMiddleware, userController.bloodDonationRequest);
router.get('/donation-list', authMiddleware, userController.userBloodList);
router.get('/get-certificate/:userId/:donationRequestId', authMiddleware, userController.generateCertificate);

router.get('/message', userController.testMessage);


module.exports = router;