const express = require('express');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/roles');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getUserStats
} = require('../controllers/userController');

const router = express.Router();

// Protect all routes and restrict to admin
router.use(protect);
router.use(restrictTo('administrator'));

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.post('/', createUser);
router.get('/:userId', getUser);
router.put('/:userId', updateUser);
router.delete('/:userId', deleteUser);
router.put('/:userId/reset-password', resetPassword);

module.exports = router;
