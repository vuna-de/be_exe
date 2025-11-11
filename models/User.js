const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Thông tin đăng nhập
  email: {
    type: String,
    required: [true, 'Email là bắt buộc'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ']
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
  },
  
  // Thông tin cá nhân
  fullName: {
    type: String,
    required: [true, 'Họ tên là bắt buộc'],
    trim: true,
    maxlength: [100, 'Họ tên không được quá 100 ký tự']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  
  // Thông tin thể chất
  height: {
    type: Number,
    min: [100, 'Chiều cao phải từ 100cm trở lên'],
    max: [250, 'Chiều cao không được quá 250cm']
  },
  weight: {
    type: Number,
    min: [30, 'Cân nặng phải từ 30kg trở lên'],
    max: [300, 'Cân nặng không được quá 300kg']
  },
  
  // Mục tiêu
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'maintenance', 'endurance'],
    default: 'maintenance'
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
  },
  
  // Vai trò và trạng thái
  role: {
    type: String,
    enum: ['user', 'trainer', 'admin'],
    default: 'user'
  },

  // OAuth
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  membershipType: {
    type: String,
    enum: ['basic', 'premium'],
    default: 'basic'
  },
  membershipExpiry: {
    type: Date
  },
  
  // Ảnh đại diện
  avatar: {
    type: String,
    default: ''
  },
  
  // Trạng thái tài khoản
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Token để reset password
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Refresh tokens
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 ngày
    }
  }],
  
  // Thống kê
  totalWorkouts: {
    type: Number,
    default: 0
  },
  joinedDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ membershipType: 1 });
userSchema.index({ googleId: 1 });

// Virtual cho tuổi
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  return Math.floor((Date.now() - this.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual cho BMI
userSchema.virtual('bmi').get(function() {
  if (!this.height || !this.weight) return null;
  const heightInM = this.height / 100;
  return Math.round((this.weight / (heightInM * heightInM)) * 10) / 10;
});

// Middleware để hash password trước khi save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method để so sánh password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method để thêm refresh token
userSchema.methods.addRefreshToken = function(token) {
  this.refreshTokens.push({ token });
  // Giữ tối đa 5 refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens.shift();
  }
  return this.save();
};

// Method để xóa refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
  return this.save();
};

// Method để kiểm tra premium membership
userSchema.methods.isPremium = function() {
  return this.membershipType === 'premium' && 
         this.membershipExpiry && 
         this.membershipExpiry > new Date();
};

module.exports = mongoose.model('User', userSchema);
