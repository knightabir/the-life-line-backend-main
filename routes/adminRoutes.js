const express = require('express');
const multer = require('multer');
const router = express.Router();

const upload = multer({ dest: 'public/' });


const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/adminAuthMiddleware');

router.post('/add-blood-group', authMiddleware, adminController.addBloodGroup);
router.put('/update-blood-group/:id', authMiddleware, adminController.updateBloodGroup);
router.delete('/delete-blood-group/:id', authMiddleware, adminController.deleteBloodGroup);
router.get('/get-blood-groups', authMiddleware, adminController.getBloodGroupsWithCount);

router.post('/add-user', authMiddleware, adminController.addUserManually);
router.post('/upload-user-csv', authMiddleware, upload.single('file'), adminController.uploadUserCSV);
router.get('/get-user-data', authMiddleware, adminController.getAllUser);
router.get('/user/:userId', authMiddleware, adminController.getUserById);
router.get('/get-bloodgroup-user/:id', authMiddleware, adminController.getUsersByBloodGroup);

router.get('/get-card-stats', authMiddleware, adminController.getCardStats);

router.get('/get-blood-requirements', authMiddleware, adminController.viewAllRequests);
router.get('/blood-requirements/:id', authMiddleware, adminController.viewRequestById);
router.get('/get-blood-donations', authMiddleware, adminController.getAllDonationRequests);
router.get('/blood-donation/:id', authMiddleware, adminController.getDonationRequestById);

router.get('/donation-stats', authMiddleware, adminController.getDonationStats);
router.get('/donation-data', authMiddleware, adminController.getFilteredDonations);
router.post('/donation-success/:donationId', authMiddleware, adminController.updateDonationStatus);



module.exports = router;