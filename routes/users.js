const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getProfile, updateProfile, searchUsers } = require('../controllers/userController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/users/me
router.get('/me', getProfile);

// PUT /api/users/me
router.put('/me', upload.single('avatar'), updateProfile);

// GET /api/users/search
router.get('/search', searchUsers);

module.exports = router;
