import AuthService from '../services/AuthService.js';

export async function requestCode(req, res) {
  try {
    const { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    const result = await AuthService.requestCode(phone, name);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

export async function verifyCode(req, res) {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone and code are required',
      });
    }

    const result = await AuthService.verifyCode(phone, code);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getCurrentUser(req, res) {
  return res.json({
    success: true,
    user: req.user,
  });
}

