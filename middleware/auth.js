const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware xác thực JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Không tìm thấy token xác thực'
      });
    }
    
    const token = authHeader.substring(7); // Bỏ "Bearer "
    
    if (!token) {
      return res.status(401).json({
        error: 'Token không hợp lệ'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Tìm user
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (!user) {
      return res.status(401).json({
        error: 'Người dùng không tồn tại'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Tài khoản đã bị vô hiệu hóa'
      });
    }
    
    // Gắn user vào request
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token không hợp lệ'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token đã hết hạn',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Lỗi xác thực'
    });
  }
};

// Middleware kiểm tra vai trò
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Vui lòng đăng nhập'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Bạn không có quyền truy cập chức năng này'
      });
    }
    
    next();
  };
};

// Middleware kiểm tra vai trò cụ thể (alias cho authorize)
const requireRole = (role) => {
  return authorize(role);
};

// Middleware kiểm tra premium membership
const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Vui lòng đăng nhập'
    });
  }
  
  // Chấp nhận các membership nâng cao: premium, pro, year/annual (nếu có)
  const type = (req.user.membershipType || '').toLowerCase();
  const map = { annual: 'year' };
  const norm = map[type] || type;
  const allowed = ['premium', 'pro', 'year'];
  if (!allowed.includes(norm) && !req.user.isPremium()) {
    return res.status(403).json({
      error: 'Chức năng này chỉ dành cho thành viên Pro/Premium',
      code: 'PREMIUM_REQUIRED'
    });
  }
  
  next();
};

// Middleware kiểm tra quyền sở hữu tài nguyên
const checkOwnership = (resourceModel, resourceParam = 'id', userField = 'user') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceParam];
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          error: 'Tài nguyên không tồn tại'
        });
      }
      
      // Admin có thể truy cập tất cả
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }
      
      // Kiểm tra quyền sở hữu
      const resourceUserId = resource[userField].toString();
      const currentUserId = req.user._id.toString();
      
      if (resourceUserId !== currentUserId) {
        return res.status(403).json({
          error: 'Bạn không có quyền truy cập tài nguyên này'
        });
      }
      
      req.resource = resource;
      next();
      
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        error: 'Lỗi kiểm tra quyền truy cập'
      });
    }
  };
};

// Middleware tùy chọn xác thực (không bắt buộc đăng nhập)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Tiếp tục mà không có user
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Tìm user
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
    
  } catch (error) {
    // Bỏ qua lỗi và tiếp tục mà không có user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireRole,
  requirePremium,
  checkOwnership,
  optionalAuth
};
