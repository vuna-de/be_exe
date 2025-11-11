const mongoose = require('mongoose');

// Schema cho gói subscription
const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên gói là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên gói không được quá 100 ký tự']
  },
  description: {
    type: String,
    required: [true, 'Mô tả gói là bắt buộc'],
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  type: {
    type: String,
    required: [true, 'Loại gói là bắt buộc'],
    enum: ['monthly', 'quarterly', 'yearly', 'lifetime'],
    default: 'monthly'
  },
  price: {
    type: Number,
    required: [true, 'Giá gói là bắt buộc'],
    min: [0, 'Giá phải lớn hơn hoặc bằng 0']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Giá gốc phải lớn hơn hoặc bằng 0']
  },
  currency: {
    type: String,
    required: [true, 'Đơn vị tiền tệ là bắt buộc'],
    enum: ['VND', 'USD'],
    default: 'VND'
  },
  duration: {
    type: Number,
    required: [true, 'Thời hạn gói là bắt buộc'],
    min: [1, 'Thời hạn phải ít nhất 1 ngày']
  },
  features: [{
    name: {
      type: String,
      required: true,
      maxlength: [100, 'Tên tính năng không được quá 100 ký tự']
    },
    description: {
      type: String,
      maxlength: [200, 'Mô tả tính năng không được quá 200 ký tự']
    },
    included: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metadata: {
    maxWorkouts: Number,
    maxMealPlans: Number,
    maxTrainers: Number,
    prioritySupport: Boolean,
    customBranding: Boolean
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual cho discount percentage
subscriptionPlanSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Schema cho payment
const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Số tiền thanh toán là bắt buộc'],
    min: [0, 'Số tiền phải lớn hơn hoặc bằng 0']
  },
  currency: {
    type: String,
    required: [true, 'Đơn vị tiền tệ là bắt buộc'],
    enum: ['VND', 'USD'],
    default: 'VND'
  },
  paymentMethod: {
    type: String,
    required: [true, 'Phương thức thanh toán là bắt buộc'],
    enum: ['vnpay', 'momo', 'zalopay', 'bank_transfer', 'cash']
  },
  status: {
    type: String,
    required: [true, 'Trạng thái thanh toán là bắt buộc'],
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    required: [true, 'Mã giao dịch là bắt buộc'],
    unique: true
  },
  vnpayTransactionId: {
    type: String,
    sparse: true
  },
  vnpayResponseCode: {
    type: String
  },
  vnpayResponseMessage: {
    type: String
  },
  paymentUrl: {
    type: String
  },
  returnUrl: {
    type: String
  },
  ipnUrl: {
    type: String
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Số tiền giảm giá phải lớn hơn hoặc bằng 0']
  },
  finalAmount: {
    type: Number,
    required: [true, 'Số tiền cuối cùng là bắt buộc'],
    min: [0, 'Số tiền cuối cùng phải lớn hơn hoặc bằng 0']
  },
  paymentData: {
    type: mongoose.Schema.Types.Mixed
  },
  failureReason: {
    type: String,
    maxlength: [500, 'Lý do thất bại không được quá 500 ký tự']
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: [true, 'Thời gian hết hạn là bắt buộc']
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ vnpayTransactionId: 1 });
paymentSchema.index({ createdAt: -1 });

// Schema cho subscription (đăng ký gói)
const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  status: {
    type: String,
    required: [true, 'Trạng thái đăng ký là bắt buộc'],
    enum: ['active', 'expired', 'cancelled', 'suspended'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: [true, 'Ngày bắt đầu là bắt buộc'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'Ngày kết thúc là bắt buộc'],
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v.getTime());
      },
      message: 'Ngày kết thúc phải là một ngày hợp lệ'
    }
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Lý do hủy không được quá 500 ký tự']
  },
  features: [{
    name: String,
    description: String,
    included: Boolean,
    used: {
      type: Number,
      default: 0
    },
    limit: Number
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual cho isExpired
subscriptionSchema.virtual('isExpired').get(function() {
  return this.endDate < new Date();
});

// Virtual cho daysRemaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Schema cho coupon/khuyến mãi
const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Mã coupon là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Mã coupon không được quá 20 ký tự']
  },
  name: {
    type: String,
    required: [true, 'Tên coupon là bắt buộc'],
    maxlength: [100, 'Tên coupon không được quá 100 ký tự']
  },
  description: {
    type: String,
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  type: {
    type: String,
    required: [true, 'Loại coupon là bắt buộc'],
    enum: ['percentage', 'fixed_amount', 'free_trial']
  },
  value: {
    type: Number,
    required: [true, 'Giá trị coupon là bắt buộc'],
    min: [0, 'Giá trị phải lớn hơn hoặc bằng 0']
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Số tiền giảm giá tối đa phải lớn hơn hoặc bằng 0']
  },
  minOrderAmount: {
    type: Number,
    min: [0, 'Số tiền đơn hàng tối thiểu phải lớn hơn hoặc bằng 0']
  },
  applicablePlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan'
  }],
  usageLimit: {
    type: Number,
    min: [1, 'Giới hạn sử dụng phải ít nhất 1']
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Số lần sử dụng phải lớn hơn hoặc bằng 0']
  },
  userLimit: {
    type: Number,
    min: [1, 'Giới hạn người dùng phải ít nhất 1']
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  validFrom: {
    type: Date,
    required: [true, 'Ngày bắt đầu hiệu lực là bắt buộc']
  },
  validTo: {
    type: Date,
    required: [true, 'Ngày kết thúc hiệu lực là bắt buộc']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual cho isExpired
couponSchema.virtual('isExpired').get(function() {
  return this.validTo < new Date();
});

// Virtual cho isAvailable
couponSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validTo >= now && 
         this.usedCount < this.usageLimit;
});

// Method để kiểm tra coupon có thể sử dụng
couponSchema.methods.canBeUsedBy = function(userId, orderAmount, planId) {
  if (!this.isAvailable) return false;
  
  // Kiểm tra user đã sử dụng chưa
  if (this.userLimit && this.usedBy.some(u => u.user.toString() === userId.toString())) {
    return false;
  }
  
  // Kiểm tra số tiền đơn hàng tối thiểu
  if (this.minOrderAmount && orderAmount < this.minOrderAmount) {
    return false;
  }
  
  // Kiểm tra plan áp dụng
  if (this.applicablePlans.length > 0 && !this.applicablePlans.includes(planId)) {
    return false;
  }
  
  return true;
};

// Method để tính discount
couponSchema.methods.calculateDiscount = function(orderAmount) {
  let discount = 0;
  
  if (this.type === 'percentage') {
    discount = (orderAmount * this.value) / 100;
  } else if (this.type === 'fixed_amount') {
    discount = this.value;
  }
  
  // Áp dụng giới hạn tối đa
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }
  
  // Không được vượt quá số tiền đơn hàng
  if (discount > orderAmount) {
    discount = orderAmount;
  }
  
  return Math.round(discount);
};

// Indexes
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
couponSchema.index({ createdBy: 1 });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = {
  SubscriptionPlan,
  Payment,
  Subscription,
  Coupon
};
