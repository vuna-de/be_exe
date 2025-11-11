const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken
} = require('../utils/jwt');
const { sendVerificationEmail, sendResetPasswordEmail } = require('../services/emailService');
const { createNotification } = require('../services/notificationService');
const { authenticate } = require('../middleware/auth');
const { 
  validateRegister, 
  validateLogin, 
  validateChangePassword,
  handleValidationErrors 
} = require('../utils/validation');
const { body } = require('express-validator');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Đăng ký tài khoản mới
// @access  Public
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, phone, password, fullName, dateOfBirth, gender } = req.body;
    
    // Kiểm tra email đã tồn tại
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({
        error: 'Email đã được sử dụng'
      });
    }
    
    // Kiểm tra số điện thoại đã tồn tại (nếu có)
    if (phone) {
      const existingUserByPhone = await User.findOne({ phone });
      if (existingUserByPhone) {
        return res.status(400).json({
          error: 'Số điện thoại đã được sử dụng'
        });
      }
    }
    
    // Tạo user mới
    const user = new User({
      email,
      phone,
      password,
      fullName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender
    });
    
    await user.save();
    
    // Tạo email verification token và gửi email
    const emailVerificationToken = generateEmailVerificationToken(user._id);
    try {
      await sendVerificationEmail(user.email, emailVerificationToken);
    } catch (err) {
      console.warn('Gửi email xác thực thất bại:', err?.message || err);
    }

    res.status(201).json({
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: user.toJSON(),
      // Chỉ trả token xác thực email trong development để tiện test
      ...(process.env.NODE_ENV === 'development' && { emailVerificationToken })
    });
    
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${field === 'email' ? 'Email' : 'Số điện thoại'} đã được sử dụng`
      });
    }
    
    res.status(500).json({
      error: 'Lỗi server khi đăng ký'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Đăng nhập
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    
    // Tìm user bằng email hoặc phone
    const isEmail = /^\S+@\S+\.\S+$/.test(emailOrPhone);
    const query = isEmail 
      ? { email: emailOrPhone.toLowerCase() }
      : { phone: emailOrPhone };
    
    const user = await User.findOne(query);
    
    if (!user) {
      return res.status(401).json({
        error: 'Email/số điện thoại hoặc mật khẩu không đúng'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Tài khoản đã bị vô hiệu hóa'
      });
    }
    
    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: 'Email chưa được xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    // Kiểm tra password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Email/số điện thoại hoặc mật khẩu không đúng'
      });
    }
    
    // Tạo tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    // Lưu refresh token
    await user.addRefreshToken(refreshToken);
    
    res.json({
      message: 'Đăng nhập thành công',
      user: user.toJSON(),
      tokens: {
        accessToken,
        refreshToken
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Lỗi server khi đăng nhập'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Làm mới access token
// @access  Public
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token là bắt buộc'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Tìm user và kiểm tra refresh token có tồn tại không
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Refresh token không hợp lệ'
      });
    }
    
    // Kiểm tra refresh token có trong database không
    const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
    
    if (!tokenExists) {
      return res.status(401).json({
        error: 'Refresh token không hợp lệ'
      });
    }
    
    // Tạo access token mới
    const newAccessToken = generateAccessToken(user._id);
    
    res.json({
      message: 'Làm mới token thành công',
      accessToken: newAccessToken
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Refresh token không hợp lệ hoặc đã hết hạn'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Đăng xuất
// @access  Private
router.post('/logout', authenticate, [
  body('refreshToken')
    .optional()
    .notEmpty()
    .withMessage('Refresh token không hợp lệ'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Xóa refresh token cụ thể
      await req.user.removeRefreshToken(refreshToken);
    } else {
      // Xóa tất cả refresh tokens (logout khỏi tất cả thiết bị)
      req.user.refreshTokens = [];
      await req.user.save();
    }
    
    res.json({
      message: 'Đăng xuất thành công'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Lỗi server khi đăng xuất'
    });
  }
});

// @route   POST /api/auth/logout-all
// @desc    Đăng xuất khỏi tất cả thiết bị
// @access  Private
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    req.user.refreshTokens = [];
    await req.user.save();
    
    res.json({
      message: 'Đăng xuất khỏi tất cả thiết bị thành công'
    });
    
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      error: 'Lỗi server khi đăng xuất'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Đổi mật khẩu
// @access  Private
router.post('/change-password', authenticate, validateChangePassword, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Kiểm tra mật khẩu hiện tại
    const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Mật khẩu hiện tại không đúng'
      });
    }
    
    // Cập nhật mật khẩu mới
    req.user.password = newPassword;
    await req.user.save();
    
    // Xóa tất cả refresh tokens để buộc đăng nhập lại
    req.user.refreshTokens = [];
    await req.user.save();
    
    res.json({
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Lỗi server khi đổi mật khẩu'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Quên mật khẩu - gửi email reset
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Không tiết lộ user có tồn tại hay không
      return res.json({
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn reset mật khẩu'
      });
    }
    
    // Tạo reset token
    const resetToken = generateResetToken(user._id);
    
    // Lưu token vào database (có thể expire sau 1 giờ)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ
    await user.save();
    
    // Gửi email với reset link (nếu cấu hình SMTP đầy đủ, nếu không bỏ qua)
    try {
      await sendResetPasswordEmail(user.email, resetToken);
    } catch (err) {
      console.warn('Gửi email đặt lại mật khẩu thất bại:', err?.message || err);
    }
    
    res.json({
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn reset mật khẩu',
      // Chỉ trả về token trong development
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Lỗi server khi xử lý quên mật khẩu'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset mật khẩu
// @access  Public
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Token reset là bắt buộc'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Verify reset token
    const decoded = verifyResetToken(token);
    
    // Tìm user với token và kiểm tra expiry
    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({
        error: 'Token reset không hợp lệ hoặc đã hết hạn'
      });
    }
    
    // Cập nhật mật khẩu
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Xóa tất cả refresh tokens
    user.refreshTokens = [];
    
    await user.save();
    
    res.json({
      message: 'Reset mật khẩu thành công. Vui lòng đăng nhập lại.'
    });
    try {
      await createNotification({
        user: user._id,
        type: 'system',
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu của bạn đã được đặt lại.'
      });
    } catch {}
    
  } catch (error) {
    const logger = require('../services/logger');
    logger.error('Reset password error', { message: error?.message, stack: error?.stack });
    res.status(400).json({
      error: 'Token reset không hợp lệ hoặc đã hết hạn'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Lấy thông tin user hiện tại
// @access  Private
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user.toJSON()
  });
});

// @route   POST /api/auth/verify-email
// @desc    Xác thực email
// @access  Public
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Token xác thực là bắt buộc'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify email verification token
    const decoded = verifyEmailVerificationToken(token);
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(400).json({
        error: 'Token xác thực không hợp lệ'
      });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        error: 'Email đã được xác thực'
      });
    }
    
    user.isEmailVerified = true;
    await user.save();
    
    res.json({
      message: 'Xác thực email thành công'
    });
    try {
      await createNotification({
        user: user._id,
        type: 'success',
        title: 'Email đã được xác thực',
        message: 'Bạn có thể đăng nhập và sử dụng đầy đủ tính năng.'
      });
    } catch {}
    
  } catch (error) {
    const logger = require('../services/logger');
    logger.error('Verify email error', { message: error?.message, stack: error?.stack });
    res.status(400).json({
      error: 'Token xác thực không hợp lệ hoặc đã hết hạn'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Gửi lại email xác thực
// @access  Public
router.post('/resend-verification', [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi lại hướng dẫn xác thực.' });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email đã được xác thực' });
    }

    const token = generateEmailVerificationToken(user._id);
    try {
      await sendVerificationEmail(user.email, token);
    } catch (err) {
      console.warn('Gửi lại email xác thực thất bại:', err?.message || err);
    }

    res.json({
      message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.',
      ...(process.env.NODE_ENV === 'development' && { emailVerificationToken: token })
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi lại email xác thực' });
  }
});

// @route   POST /api/auth/google
// @desc    Đăng nhập bằng Google (Google Identity Services) - nhận id_token từ client
// @access  Public
router.post('/google', [
  body('idToken')
    .notEmpty()
    .withMessage('idToken là bắt buộc')
], async (req, res) => {
  try {
    const { idToken } = req.body;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_CLIENT_ID' });
    }

    // Verify id_token với Google
    const ticketRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!ticketRes.ok) {
      return res.status(401).json({ error: 'idToken không hợp lệ' });
    }
    const payload = await ticketRes.json();

    if (payload.aud !== clientId) {
      return res.status(401).json({ error: 'idToken không khớp client id' });
    }

    const googleId = payload.sub;
    const email = (payload.email || '').toLowerCase();
    const fullName = payload.name || payload.given_name || 'Người dùng Google';
    const emailVerified = payload.email_verified === 'true' || payload.email_verified === true;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Tạo tài khoản mới theo Google
      user = new User({
        email,
        password: Math.random().toString(36).slice(2) + 'Aa1',
        fullName,
        provider: 'google',
        googleId,
        isEmailVerified: emailVerified,
      });
      await user.save();
    } else {
      // Liên kết googleId nếu chưa có
      let hasChanges = false;
      if (!user.googleId) { user.googleId = googleId; hasChanges = true; }
      if (!user.isEmailVerified && emailVerified) { user.isEmailVerified = true; hasChanges = true; }
      if (user.provider !== 'google') { user.provider = 'google'; hasChanges = true; }
      if (hasChanges) await user.save();
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    }

    // Tạo tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    await user.addRefreshToken(refreshToken);

    res.json({
      message: 'Đăng nhập Google thành công',
      user: user.toJSON(),
      tokens: { accessToken, refreshToken }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Lỗi server khi đăng nhập Google' });
  }
});

module.exports = router;
