import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SMSService from './SMSService.js';
import config from '../config/index.js';

class AuthService {
  /**
   * Request verification code
   * If user doesn't exist - create new user
   */
  async requestCode(phone, name) {
    // Validate phone format
    if (!/^79\d{9}$/.test(phone)) {
      throw new Error('Invalid phone format. Expected: 79XXXXXXXXX');
    }

    // Generate verification code
    const code = SMSService.generateCode();
    const expiresAt = SMSService.getCodeExpirationTime();

    // Find or create user
    let user = await User.findOne({ phone });
    
    if (!user) {
      // First time login - auto register
      if (!name) {
        throw new Error('Name is required for new users');
      }
      
      user = new User({
        phone,
        name,
        verificationCode: { code, expiresAt },
      });
    } else {
      // Update verification code for existing user
      user.verificationCode = { code, expiresAt };
      
      // Update name if provided
      if (name) {
        user.name = name;
      }
    }

    await user.save();

    // Send SMS
    await SMSService.sendVerificationCode(phone, code);

    return {
      success: true,
      message: 'Verification code sent',
      isNewUser: !user.createdAt || user.createdAt.getTime() === user.lastActiveAt.getTime(),
    };
  }

  /**
   * Verify code and generate JWT token
   */
  async verifyCode(phone, code) {
    const user = await User.findOne({ phone });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isVerificationCodeValid(code)) {
      throw new Error('Invalid or expired verification code');
    }

    // Clear verification code after successful verification
    user.verificationCode = undefined;
    await user.save();

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      success: true,
      token,
      user: {
        userId: user.userId,
        phone: user.phone,
        name: user.name,
      },
    };
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user.userId,
      phone: user.phone,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by token
   */
  async getUserByToken(token) {
    const decoded = this.verifyToken(token);
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export default new AuthService();

