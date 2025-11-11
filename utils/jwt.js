const jwt = require('jsonwebtoken');

// Tạo access token
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'gym-manager',
      audience: 'gym-manager-users'
    }
  );
};

// Tạo refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'gym-manager',
      audience: 'gym-manager-users'
    }
  );
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Token không phải là refresh token');
    }
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Tạo reset password token
const generateResetToken = (userId) => {
  return jwt.sign(
    { userId, type: 'reset' },
    process.env.JWT_SECRET,
    { 
      expiresIn: '1h',
      issuer: 'gym-manager',
      audience: 'gym-manager-users'
    }
  );
};

// Verify reset token
const verifyResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'reset') {
      throw new Error('Token không phải là reset token');
    }
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Tạo email verification token
const generateEmailVerificationToken = (userId) => {
  return jwt.sign(
    { userId, type: 'email_verification' },
    process.env.JWT_SECRET,
    { 
      expiresIn: '24h',
      issuer: 'gym-manager',
      audience: 'gym-manager-users'
    }
  );
};

// Verify email verification token
const verifyEmailVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'email_verification') {
      throw new Error('Token không phải là email verification token');
    }
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Decode token mà không verify (để lấy thông tin)
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

// Kiểm tra token có hết hạn không
const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// Lấy thời gian còn lại của token (giây)
const getTokenRemainingTime = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return 0;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const remainingTime = decoded.exp - currentTime;
    
    return remainingTime > 0 ? remainingTime : 0;
  } catch (error) {
    return 0;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  decodeToken,
  isTokenExpired,
  getTokenRemainingTime
};
