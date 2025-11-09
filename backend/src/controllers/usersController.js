import User from '../models/User.js';
import Chat3Client from '../services/Chat3Client.js';

export async function listUsers(req, res) {
  try {
    const { search, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    const query = {
      userId: { $ne: currentUserId },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('userId name phone createdAt lastActiveAt')
      .limit(parseInt(limit, 10))
      .sort({ lastActiveAt: -1, createdAt: -1 });

    const usersWithAvatars = await Promise.all(
      users.map(async (user) => {
        let avatar = null;
        try {
          const chat3User = await Chat3Client.getUser(user.userId);
          const chat3UserData = chat3User.data || chat3User;
          avatar =
            chat3UserData.meta?.avatar?.value ||
            chat3UserData.meta?.avatar ||
            chat3UserData.avatar ||
            null;
        } catch (error) {
          if (error.response?.status !== 404) {
            console.warn(`Failed to get avatar for user ${user.userId}:`, error.message);
          }
        }

        return {
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          avatar,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
        };
      }),
    );

    return res.json({
      success: true,
      data: usersWithAvatars,
      total: usersWithAvatars.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
}

export async function getCurrentUserProfile(req, res) {
  try {
    const userId = req.user.userId;

    const user = await User.findOne({ userId }).select('userId name phone createdAt lastActiveAt');

    let avatar = null;
    try {
      const chat3Response = await Chat3Client.getUser(userId);
      const chat3User = chat3Response?.data || chat3Response;

      console.log(
        `📋 getUser response for ${userId}:`,
        JSON.stringify({
          hasData: !!chat3Response?.data,
          hasMeta: !!chat3User?.meta,
          metaKeys: chat3User?.meta ? Object.keys(chat3User.meta) : [],
          hasAvatar: !!chat3User?.meta?.avatar,
        }),
      );

      if (chat3User?.avatar) {
        avatar =
          typeof chat3User.avatar === 'string'
            ? chat3User.avatar
            : chat3User.avatar?.value || null;
        console.log(`✅ Avatar found in chat3User.avatar for ${userId}`);
      } else if (chat3User?.meta?.avatar) {
        avatar =
          typeof chat3User.meta.avatar === 'string'
            ? chat3User.meta.avatar
            : chat3User.meta.avatar?.value || null;
        console.log(`✅ Avatar found in chat3User.meta.avatar for ${userId}`);
      } else {
        console.log(`⚠️ No avatar found in user data for ${userId}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ User ${userId} not found in Chat3, trying getMeta...`);
        try {
          const meta = await Chat3Client.getMeta('user', userId);
          if (meta?.avatar) {
            avatar =
              typeof meta.avatar === 'string' ? meta.avatar : meta.avatar?.value || null;
            console.log(`✅ Avatar found in meta.avatar for ${userId}`);
          }
        } catch (metaError) {
          if (metaError.response?.status !== 404) {
            console.log(`Error getting meta from Chat3 for user ${userId}:`, metaError.message);
          }
        }
      } else {
        console.log(`Error getting user from Chat3 for ${userId}:`, error.message);
      }
    }

    if (!user) {
      console.warn('⚠️ User not found in DB, using data from req.user (middleware)');
      return res.json({
        success: true,
        data: {
          userId: req.user.userId,
          name: req.user.name || null,
          phone: req.user.phone || null,
          createdAt: null,
          lastActiveAt: null,
          avatar,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        userId: user.userId,
        name: user.name || req.user.name || null,
        phone: user.phone || req.user.phone || null,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
        avatar,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user profile',
    });
  }
}

export async function updateCurrentUserAvatar(req, res) {
  try {
    const userId = req.user.userId;
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({
        success: false,
        error: 'Avatar is required',
      });
    }

    const isBase64 = avatar.startsWith('data:image/');
    const isUrl = avatar.startsWith('http://') || avatar.startsWith('https://');

    if (!isBase64 && !isUrl) {
      return res.status(400).json({
        success: false,
        error: 'Avatar must be a base64 data URL or HTTP(S) URL',
      });
    }

    try {
      await Chat3Client.getUser(userId);
      console.log(`✅ User ${userId} exists in Chat3 API`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ User ${userId} not found in Chat3 API, creating user...`);
        try {
          const user = await User.findOne({ userId }).select('userId name phone');

          if (user) {
            await Chat3Client.createUser(userId, {
              name: user.name,
              phone: user.phone,
            });
            console.log(`✅ User ${userId} created in Chat3 API`);
          } else {
            await Chat3Client.createUser(userId, {
              name: req.user.name,
              phone: req.user.phone,
            });
            console.log(`✅ User ${userId} created in Chat3 API (from req.user)`);
          }
        } catch (createError) {
          console.error(`❌ Error creating user ${userId} in Chat3 API:`, createError.message);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    try {
      console.log(`📤 Saving avatar to Chat3 meta for user ${userId}, avatar length: ${avatar?.length || 0}`);
      await Chat3Client.setMeta('user', userId, 'avatar', { value: avatar });
      console.log(`✅ Avatar saved to Chat3 meta for user ${userId}`);

      try {
        const verifyUser = await Chat3Client.getUser(userId);
        console.log(
          `📋 Verify getUser response for ${userId}:`,
          JSON.stringify({
            hasAvatar: !!verifyUser?.avatar,
            hasMeta: !!verifyUser?.meta,
            metaKeys: verifyUser?.meta ? Object.keys(verifyUser.meta) : [],
            metaAvatar: !!verifyUser?.meta?.avatar,
            metaAvatarValue: verifyUser?.meta?.avatar
              ? typeof verifyUser.meta.avatar === 'string'
                ? 'string'
                : typeof verifyUser.meta.avatar
              : null,
          }),
        );
        if (verifyUser?.meta?.avatar) {
          console.log(`✅ Avatar verified in Chat3 for user ${userId}`);
        } else {
          console.warn(
            `⚠️ Avatar not found in Chat3 after save for user ${userId}, full response:`,
            JSON.stringify(verifyUser).substring(0, 500),
          );
        }
      } catch (verifyError) {
        console.warn(`⚠️ Could not verify avatar after save for user ${userId}:`, verifyError.message);
      }
    } catch (error) {
      console.error(`❌ Error saving avatar to Chat3 meta for user ${userId}:`, error.message);
      console.error('Error details:', error.response?.data || error);
      throw error;
    }

    return res.json({
      success: true,
      message: 'Avatar updated',
      data: { avatar },
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update avatar',
    });
  }
}

export async function deleteCurrentUserAvatar(req, res) {
  try {
    const userId = req.user.userId;

    try {
      await Chat3Client.deleteMeta('user', userId, 'avatar');
      console.log(`✅ Avatar deleted from Chat3 meta for user ${userId}`);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error(`❌ Error deleting avatar from Chat3 meta for user ${userId}:`, error.message);
        throw error;
      }
    }

    return res.json({
      success: true,
      message: 'Avatar deleted',
    });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete avatar',
    });
  }
}

export async function getUserById(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }).select('userId name phone createdAt lastActiveAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    let avatar = null;
    try {
      const chat3Response = await Chat3Client.getUser(userId);
      const chat3User = chat3Response?.data || chat3Response;

      console.log(
        `📋 getUser response for ${userId}:`,
        JSON.stringify({
          hasData: !!chat3Response?.data,
          hasMeta: !!chat3User?.meta,
          metaKeys: chat3User?.meta ? Object.keys(chat3User.meta) : [],
          hasAvatar: !!chat3User?.meta?.avatar,
        }),
      );

      if (chat3User?.avatar) {
        avatar =
          typeof chat3User.avatar === 'string'
            ? chat3User.avatar
            : chat3User.avatar?.value || null;
        console.log(`✅ Avatar found in chat3User.avatar for ${userId}`);
      } else if (chat3User?.meta?.avatar) {
        avatar =
          typeof chat3User.meta.avatar === 'string'
            ? chat3User.meta.avatar
            : chat3User.meta.avatar?.value || null;
        console.log(`✅ Avatar found in chat3User.meta.avatar for ${userId}`);
      } else {
        console.log(`⚠️ No avatar found in user data for ${userId}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ User ${userId} not found in Chat3, trying getMeta...`);
        try {
          const meta = await Chat3Client.getMeta('user', userId);
          if (meta?.avatar) {
            avatar =
              typeof meta.avatar === 'string' ? meta.avatar : meta.avatar?.value || null;
            console.log(`✅ Avatar found in meta.avatar for ${userId}`);
          }
        } catch (metaError) {
          if (metaError.response?.status !== 404) {
            console.log(`Error getting meta from Chat3 for user ${userId}:`, metaError.message);
          }
        }
      } else {
        console.log(`Error getting user from Chat3 for ${userId}:`, error.message);
      }
    }

    return res.json({
      success: true,
      data: {
        ...user.toObject(),
        avatar,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
    });
  }
}

