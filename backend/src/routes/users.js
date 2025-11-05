import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/users
 * Get list of all users (for creating dialogs)
 * Requires authentication
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    // Build query
    const query = {
      userId: { $ne: currentUserId } // Exclude current user
    };

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users
    const users = await User.find(query)
      .select('userId name phone createdAt lastActiveAt')
      .limit(parseInt(limit))
      .sort({ lastActiveAt: -1, createdAt: -1 });

    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by userId
 * Requires authentication
 */
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId })
      .select('userId name phone createdAt lastActiveAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

export default router;

