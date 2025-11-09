import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SMSService from './SMSService.js';
import config from '../config/index.js';
import Chat3Client from './Chat3Client.js';

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
    let isNewUser = false;
    let nameChanged = false;

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
      isNewUser = true;
    } else {
      // Update verification code for existing user
      user.verificationCode = { code, expiresAt };

      // Update name if provided
      if (name) {
        const trimmedName = name.trim();
        if (trimmedName && trimmedName !== user.name) {
          user.name = trimmedName;
          nameChanged = true;
        }
      }
    }

    const wasNewBeforeSave = user.isNew;
    const nameModifiedBeforeSave = user.isModified('name');

    await user.save();

    try {
      await this.syncChat3User(user, {
        isNewUser: isNewUser || wasNewBeforeSave,
        nameChanged: nameChanged || nameModifiedBeforeSave,
      });
    } catch (syncError) {
      console.warn('⚠️  Failed to synchronize user with Chat3:', syncError.message);
    }

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

    try {
      await this.syncChat3User(user, { force: true });
    } catch (syncError) {
      console.warn(
        `⚠️  Failed to ensure Chat3 profile for user ${user.userId}:`,
        syncError.message,
      );
    }

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

  /**
   * Synchronize local user with Chat3 users directory.
   */
  async syncChat3User(user, options = {}) {
    if (!user || !user.userId) {
      return;
    }

    const { isNewUser = false, nameChanged = false, force = false } = options;

    if (!force && !isNewUser && !nameChanged) {
      // Nothing changed that requires sync.
      return;
    }

    const payload = {
      name: user.name,
      phone: user.phone,
      meta: {
        displayName: user.name,
        fullName: user.name,
        phone: user.phone,
      },
    };

    if (isNewUser) {
      try {
        await Chat3Client.createUser(user.userId, payload);
        console.log(`✅ Created Chat3 user ${user.userId}`);
        return;
      } catch (error) {
        if (error.response?.status !== 409) {
          console.warn(
            `⚠️  Failed to create Chat3 user ${user.userId}:`,
            error.message,
          );
        }
        // Fall through to update attempt.
      }
    }

    try {
      await Chat3Client.updateUser(user.userId, payload);
      console.log(`✅ Updated Chat3 user ${user.userId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          await Chat3Client.createUser(user.userId, payload);
          console.log(`✅ Created Chat3 user ${user.userId} after 404 on update`);
        } catch (createError) {
          console.error(
            `❌ Failed to create Chat3 user ${user.userId} after 404:`,
            createError.message,
          );
          if (createError.response?.data) {
            console.error('Error details:', createError.response.data);
          }
        }
        return;
      }

      console.error(
        `❌ Failed to update Chat3 user ${user.userId}:`,
        error.message,
      );
      if (error.response?.data) {
        console.error('Error details:', error.response.data);
      }
    }
  }
}

export default new AuthService();

