const { Op } = require('sequelize');
const User = require('../models/User');
const Scan = require('../models/Scan');
const logger = require('../utils/logger');

// Get all users (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    if (search) {
      whereClause = {
        [Op.or]: [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ]
      };
    }
    
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalUsers: count,
        hasNext: offset + limit < count,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get specific user (Admin only)
exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Scan,
        limit: 5,
        order: [['createdAt', 'DESC']]
      }]
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Create new user (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with that email or username already exists'
      });
    }
    
    const user = await User.create({
      username,
      email,
      password,
      role
    });
    
    logger.info(`User created by admin: ${username}`);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    logger.error(`Create user error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, role, status } = req.body;
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from changing their own role
    if (req.user.id === userId && role && role !== user.role) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }
    
    if (email) user.email = email;
    if (role) user.role = role;
    if (status) user.status = status;
    
    await user.save();
    
    logger.info(`User updated by admin: ${user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has scans
    const scanCount = await Scan.count({ where: { userId } });
    
    if (scanCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete user with existing scans. Please delete scans first.'
      });
    }
    
    await user.destroy();
    
    logger.info(`User deleted by admin: ${user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Reset user password (Admin only)
exports.resetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    logger.info(`Password reset by admin for user: ${user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// Get user statistics (Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const adminUsers = await User.count({ where: { role: 'administrator' } });
    const regularUsers = await User.count({ where: { role: 'user' } });
    
    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await User.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        adminUsers,
        regularUsers,
        recentRegistrations: recentUsers
      }
    });
  } catch (error) {
    logger.error(`Get user stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};
