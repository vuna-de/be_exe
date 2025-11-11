const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: {
    type: String,
    required: [true, 'Mã voucher là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{6,20}$/, 'Mã voucher phải từ 6-20 ký tự, chỉ chứa chữ cái và số']
  },
  name: {
    type: String,
    required: [true, 'Tên voucher là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên voucher không được quá 100 ký tự']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },

  // Loại giảm giá
  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount'],
    required: [true, 'Loại giảm giá là bắt buộc']
  },
  discountValue: {
    type: Number,
    required: [true, 'Giá trị giảm giá là bắt buộc'],
    min: [0, 'Giá trị giảm giá không được âm']
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Số tiền giảm tối đa không được âm']
  },

  // Điều kiện sử dụng
  minOrderAmount: {
    type: Number,
    min: [0, 'Đơn hàng tối thiểu không được âm'],
    default: 0
  },
  applicablePlans: [{
    type: String,
    enum: ['basic', 'premium', 'pro', 'year']
  }],

  // Giới hạn sử dụng
  usageLimit: {
    type: Number,
    min: [1, 'Giới hạn sử dụng phải ít nhất 1'],
    default: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Số lần sử dụng không được âm']
  },
  usageLimitPerUser: {
    type: Number,
    min: [1, 'Giới hạn sử dụng mỗi user phải ít nhất 1'],
    default: 1
  },

  // Thời gian hiệu lực
  validFrom: {
    type: Date,
    required: [true, 'Ngày bắt đầu hiệu lực là bắt buộc']
  },
  validUntil: {
    type: Date,
    required: [true, 'Ngày kết thúc hiệu lực là bắt buộc']
  },

  // Trạng thái
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },

  // Thông tin tạo
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Thống kê
  totalDiscountGiven: {
    type: Number,
    default: 0,
    min: [0, 'Tổng giảm giá không được âm']
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
voucherSchema.index({ code: 1 });
voucherSchema.index({ isActive: 1 });
voucherSchema.index({ validFrom: 1, validUntil: 1 });
voucherSchema.index({ createdBy: 1 });

// Virtual để kiểm tra voucher có còn hiệu lực không
voucherSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         this.usedCount < this.usageLimit;
});

// Virtual để kiểm tra voucher có còn slot không
voucherSchema.virtual('remainingUses').get(function() {
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Method để tăng số lần sử dụng
voucherSchema.methods.incrementUsage = function(discountAmount = 0) {
  this.usedCount += 1;
  this.totalDiscountGiven += discountAmount;
  return this.save();
};

// Method để kiểm tra user có thể sử dụng voucher này không
voucherSchema.methods.canBeUsedBy = function(userId, orderAmount = 0) {
  if (!this.isValid) return false;
  if (orderAmount < this.minOrderAmount) return false;
  
  // TODO: Kiểm tra usageLimitPerUser khi có bảng VoucherUsage
  return true;
};

// Method để tính toán giảm giá
voucherSchema.methods.calculateDiscount = function(orderAmount) {
  console.log('calculateDiscount debug:', {
    orderAmount,
    minOrderAmount: this.minOrderAmount,
    discountType: this.discountType,
    discountValue: this.discountValue,
    maxDiscountAmount: this.maxDiscountAmount
  });
  
  if (orderAmount < this.minOrderAmount) {
    console.log('Order amount too low:', orderAmount, '<', this.minOrderAmount);
    return 0;
  }
  
  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = (orderAmount * this.discountValue) / 100;
    console.log('Percentage discount calculated:', discount);
  } else {
    discount = this.discountValue;
    console.log('Fixed amount discount:', discount);
  }
  
  // Áp dụng giới hạn tối đa
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    console.log('Applying max discount limit:', this.maxDiscountAmount);
    discount = this.maxDiscountAmount;
  }
  
  const finalDiscount = Math.min(discount, orderAmount);
  console.log('Final discount amount:', finalDiscount);
  
  return finalDiscount;
};

// Static method để tìm voucher hợp lệ theo code
voucherSchema.statics.findValidByCode = function(code) {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
    $expr: { $lt: ['$usedCount', '$usageLimit'] }
  });
};

module.exports = mongoose.model('Voucher', voucherSchema);
