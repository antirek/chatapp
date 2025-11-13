import AuthService from '../services/AuthService.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and get user
    const user = await AuthService.getUserByToken(token);

    // Attach user to request
    req.user = {
      userId: user.userId,
      phone: user.phone,
      name: user.name,
      accountId: user.accountId,
    };

    // Log if accountId is missing (for debugging)
    if (!req.user.accountId) {
      console.warn(`⚠️ User ${req.user.userId} authenticated but accountId is missing. User object:`, {
        userId: user.userId,
        hasAccountId: !!user.accountId,
        accountId: user.accountId,
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if not
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await AuthService.getUserByToken(token);
      
      req.user = {
        userId: user.userId,
        phone: user.phone,
        name: user.name,
      };
    }
  } catch (error) {
    // Ignore errors in optional auth
  }
  
  next();
};

