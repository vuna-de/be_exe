const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { SubscriptionPlan, Payment, Subscription, Coupon } = require('../models/Payment');
const Voucher = require('../models/Voucher');
const { authenticate, optionalAuth } = require('../middleware/auth');
const vnpayService = require('../services/vnpayService');
const crypto = require('crypto');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

// ==================== SUBSCRIPTION PLANS ====================

// Lấy danh sách gói subscription
router.get('/plans', optionalAuth, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 })
      .lean();

    res.json({
      plans: plans.map(plan => ({
        ...plan,
        discountPercentage: plan.originalPrice && plan.originalPrice > plan.price 
          ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)
          : 0
      }))
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách gói đăng ký' });
  }
});

// Lấy chi tiết gói subscription
router.get('/plans/:id', optionalAuth, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id).lean();

    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Không tìm thấy gói đăng ký' });
    }

    const discountPercentage = plan.originalPrice && plan.originalPrice > plan.price 
      ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100)
      : 0;

    res.json({
      plan: {
        ...plan,
        discountPercentage
      }
    });
  } catch (error) {
    console.error('Get subscription plan error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết gói đăng ký' });
  }
});

// ==================== COUPONS ====================

// Lấy danh sách coupon có sẵn
router.get('/coupons', optionalAuth, async (req, res) => {
  try {
    const { code, planId } = req.query;
    
    let query = { isActive: true, isPublic: true };
    
    if (code) {
      query.code = { $regex: new RegExp(code, 'i') };
    }

    const coupons = await Coupon.find(query)
      .populate('applicablePlans', 'name price')
      .sort({ createdAt: -1 })
      .lean();

    // Lọc coupon phù hợp với plan nếu có
    let filteredCoupons = coupons;
    if (planId) {
      filteredCoupons = coupons.filter(coupon => 
        coupon.applicablePlans.length === 0 || 
        coupon.applicablePlans.some(plan => plan._id.toString() === planId)
      );
    }

    res.json({ coupons: filteredCoupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách coupon' });
  }
});

// Kiểm tra coupon
router.post('/coupons/validate', authenticate, [
  body('code').trim().notEmpty().withMessage('Mã coupon là bắt buộc'),
  body('planId').isMongoId().withMessage('ID gói không hợp lệ'),
  body('amount').isFloat({ min: 0 }).withMessage('Số tiền phải lớn hơn hoặc bằng 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, planId, amount } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      isActive: true 
    }).populate('applicablePlans');

    if (!coupon) {
      return res.status(404).json({ error: 'Mã coupon được tìm thấy hoặc đã hết hạn' });
    }

    // Kiểm tra coupon có thể sử dụng
    const canUse = coupon.canBeUsedBy(req.user._id, amount, planId);
    if (!canUse) {
      return res.status(400).json({ error: 'Mã coupon không thể sử dụng cho gói này' });
    }

    // Tính discount
    const discountAmount = coupon.calculateDiscount(amount);
    const finalAmount = Math.max(0, amount - discountAmount);

    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        discountAmount,
        finalAmount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra coupon' });
  }
});

// ==================== VOUCHERS ====================

// Lấy danh sách voucher có sẵn (để hiển thị cho user)
router.get('/vouchers', optionalAuth, async (req, res) => {
  try {
    const { planId } = req.query;
    
    const now = new Date();
    let filter = { 
      isActive: true, 
      isPublic: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    };
    
    // Kiểm tra voucher chưa hết lượt sử dụng
    filter.$expr = { $lt: ['$usedCount', '$usageLimit'] };

    const coupons = await Voucher.find(filter)
      .select('code name description discountType discountValue maxDiscountAmount minOrderAmount validUntil usedCount usageLimit')
      .sort({ createdAt: -1 })
      .limit(10) // Giới hạn để tránh spam quá nhiều
      .lean();

    // Lọc voucher phù hợp với plan nếu có
    let filteredCoupons = coupons;
    if (planId) {
      filteredCoupons = coupons.filter(voucher => 
        voucher.applicablePlans.length === 0 || 
        voucher.applicablePlans.includes(planId)
      );
    }

    res.json({ coupons: filteredCoupons });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách voucher' });
  }
});

// Kiểm tra voucher (thay thế coupon validate)
router.post('/vouchers/validate', authenticate, [
  body('code').trim().notEmpty().withMessage('Mã voucher là bắt buộc'),
  body('planId').isMongoId().withMessage('ID gói không hợp lệ'),
  body('amount').isFloat({ min: 0 }).withMessage('Số tiền phải lớn hơn hoặc bằng 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, planId, amount } = req.body;

    // Tìm voucher hợp lệ
    const voucher = await Voucher.findValidByCode(code.toUpperCase());

    if (!voucher) {
      return res.status(404).json({ error: 'Mã voucher không tồn tại hoặc đã hết hạn' });
    }

    // Kiểm tra voucher có thể sử dụng cho user này không
    const canUse = voucher.canBeUsedBy(req.user._id, amount);
    if (!canUse) {
      return res.status(400).json({ error: 'Mã voucher không thể sử dụng cho gói này' });
    }

    // Kiểm tra voucher có áp dụng cho plan này không
    if (voucher.applicablePlans.length > 0 && !voucher.applicablePlans.includes(planId)) {
      return res.status(400).json({ error: 'Mã voucher không áp dụng cho gói này' });
    }

    // Tính discount
    const discountAmount = voucher.calculateDiscount(amount);
    const finalAmount = Math.max(0, amount - discountAmount);
    
    console.log('Voucher validation debug:', {
      voucherId: voucher._id,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      orderAmount: amount,
      minOrderAmount: voucher.minOrderAmount,
      calculatedDiscount: discountAmount,
      finalAmount
    });

    res.json({
      valid: true,
      coupon: {
        _id: voucher._id,
        code: voucher.code,
        name: voucher.name,
        type: voucher.discountType,
        value: voucher.discountValue,
        discountAmount,
        finalAmount
      }
    });
  } catch (error) {
    console.error('Validate voucher error:', error);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra voucher' });
  }
});

// ==================== PAYMENT ====================

// Tạo thanh toán VNPay
router.post('/vnpay/create', authenticate, [
  body('planId').isMongoId().withMessage('ID gói không hợp lệ'),
  body('couponCode').optional().trim(),
  body('paymentMethod').isIn(['vnpay', 'momo', 'zalopay']).withMessage('Phương thức thanh toán không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planId, couponCode, paymentMethod } = req.body;

    // Lấy thông tin gói
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Gói đăng ký không tồn tại' });
    }

    let discountAmount = 0;
    let coupon = null;
    let voucher = null;

    // Kiểm tra voucher trước, sau đó kiểm tra coupon
    if (couponCode) {
      // Thử tìm voucher trước
      voucher = await Voucher.findValidByCode(couponCode.toUpperCase());
      
      if (voucher) {
        const canUse = voucher.canBeUsedBy(req.user._id, plan.price);
        if (canUse && (voucher.applicablePlans.length === 0 || voucher.applicablePlans.includes(planId))) {
          discountAmount = voucher.calculateDiscount(plan.price);
        }
      } else {
        // Nếu không tìm thấy voucher, thử coupon
        coupon = await Coupon.findOne({ 
          code: couponCode.toUpperCase(), 
          isActive: true 
        });

        if (coupon) {
          const canUse = coupon.canBeUsedBy(req.user._id, plan.price, planId);
          if (canUse) {
            discountAmount = coupon.calculateDiscount(plan.price);
          }
        }
      }
    }

    const finalAmount = Math.max(0, plan.price - discountAmount);

    // Tạo transaction ID
    const transactionId = `GYM_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Tạo payment record
    const payment = new Payment({
      user: req.user._id,
      subscriptionPlan: planId,
      amount: plan.price,
      currency: plan.currency,
      paymentMethod,
      transactionId,
      coupon: coupon?._id, // Để tương thích với cấu trúc cũ
      voucher: voucher?._id, // Thêm voucher mới
      discountAmount,
      finalAmount,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 phút
    });

    await payment.save();

    // Tạo URL thanh toán VNPay
    const paymentData = {
      amount: finalAmount,
      orderId: transactionId,
      bankCode: '',
      language: 'vn',
      orderDescription: `Thanh toán gói ${plan.name}`,
      orderType: 'other',
      ipAddr: req.ip || req.connection.remoteAddress
    };

    const vnpayResult = vnpayService.createPaymentUrl(paymentData, req);

    // Cập nhật payment với thông tin VNPay
    payment.paymentUrl = vnpayResult.paymentUrl;
    payment.vnpayTransactionId = vnpayResult.transactionId;
    payment.returnUrl = vnpayResult.returnUrl;
    payment.ipnUrl = vnpayResult.ipnUrl;
    await payment.save();

    res.json({
      message: 'Tạo thanh toán thành công',
      payment: {
        _id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.finalAmount,
        paymentUrl: payment.paymentUrl,
        expiresAt: payment.expiresAt
      }
    });
  } catch (error) {
    const logger = require('../services/logger');
    logger.error('Create VNPay payment error', { message: error?.message, stack: error?.stack });
    res.status(500).json({ error: 'Lỗi server khi tạo thanh toán' });
  }
});

// Xử lý return URL từ VNPay
router.get('/vnpay/return', async (req, res) => {
  try {
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    let tmnCode = process.env.VNPAY_TMN_CODE;
    let secretKey = process.env.VNPAY_HASH_SECRET;

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");     

    
    // Xác thực chữ ký
    const isValid = secureHash === signed;
    
    if (!isValid) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=invalid_signature`);
    }

    const transactionId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const responseMessage = vnpayService.getResponseMessage(responseCode);

    // Tìm payment và populate subscriptionPlan
    const payment = await Payment.findOne({ transactionId }).populate('subscriptionPlan');
    if (!payment) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=payment_not_found`);
    }

    // Cập nhật trạng thái payment
    if (responseCode === '00') {
      payment.status = 'completed';
      payment.vnpayResponseCode = responseCode;
      payment.vnpayResponseMessage = responseMessage;
      payment.completedAt = new Date();
      
      // Tạo subscription với validation duration
      const startDate = new Date();
      let endDate;
      
      console.log('Payment subscription plan:', payment.subscriptionPlan);
      
      if (payment.subscriptionPlan && payment.subscriptionPlan.duration && typeof payment.subscriptionPlan.duration === 'number') {
        // Duration tính bằng ngày, chuyển thành milliseconds
        endDate = new Date(startDate.getTime() + payment.subscriptionPlan.duration * 24 * 60 * 60 * 1000);
        console.log('Using subscription plan duration:', payment.subscriptionPlan.duration, 'days');
      } else {
        // Fallback: 30 ngày nếu không có duration
        console.warn('Subscription plan duration not found or invalid, using 30 days as fallback');
        endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      
      console.log('Subscription dates - Start:', startDate, 'End:', endDate);
      
      let subscription;
      try {
        subscription = new Subscription({
          user: payment.user,
          subscriptionPlan: payment.subscriptionPlan,
          payment: payment._id,
          startDate: startDate,
          endDate: endDate
        });
        
        await subscription.save();
        console.log('Subscription created successfully:', subscription._id);
      } catch (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        throw subscriptionError;
      }
      
      // Cập nhật user role nếu cần
      const User = require('../models/User');
      await User.findByIdAndUpdate(payment.user, { 
        membershipType: 'premium',
        subscription: subscription._id
      });

      // Cập nhật coupon usage nếu có
      if (payment.coupon) {
        await Coupon.findByIdAndUpdate(payment.coupon, {
          $inc: { usedCount: 1 },
          $push: { 
            usedBy: { 
              user: payment.user, 
              usedAt: new Date() 
            } 
          }
        });
      }

      // Cập nhật voucher usage nếu có
      if (payment.voucher) {
        await Voucher.findByIdAndUpdate(payment.voucher, {
          $inc: { 
            usedCount: 1,
            totalDiscountGiven: payment.discountAmount || 0
          }
        });
      }

      await payment.save();

      // Thông báo thanh toán thành công
      createNotification({
        user: payment.user,
        type: 'payment',
        title: 'Thanh toán thành công',
        message: `Bạn đã nâng cấp gói thành công. Mã giao dịch: ${transactionId}`,
        data: { transactionId }
      });

      return res.redirect(`${process.env.FRONTEND_URL}/profile?transactionId=${transactionId}`);
    } else {
      payment.status = 'failed';
      payment.vnpayResponseCode = responseCode;
      payment.vnpayResponseMessage = responseMessage;
      payment.failureReason = responseMessage;
      await payment.save();

      // Thông báo thanh toán thất bại
      createNotification({
        user: payment.user,
        type: 'payment',
        title: 'Thanh toán thất bại',
        message: `Giao dịch không thành công: ${responseMessage}`,
        data: { transactionId }
      });

      return res.redirect(`${process.env.FRONTEND_URL}/profile?error=${responseCode}&message=${encodeURIComponent(responseMessage)}`);
    }
  } catch (error) {
    console.error('VNPay return error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=server_error`);
  }
});

// Xử lý IPN từ VNPay
router.post('/vnpay/ipn', async (req, res) => {
  try {
    const vnp_Params = req.body;
    
    // Xác thực chữ ký
    const isValid = vnpayService.verifyIpn(vnp_Params);
    
    if (!isValid) {
      return res.status(400).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    const transactionId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];

    // Tìm payment
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(400).json({ RspCode: '01', Message: 'Order not found' });
    }

    // Cập nhật trạng thái payment
    if (responseCode === '00' && payment.status === 'pending') {
      payment.status = 'completed';
      payment.vnpayResponseCode = responseCode;
      payment.vnpayResponseMessage = vnpayService.getResponseMessage(responseCode);
      payment.completedAt = new Date();
      
      await payment.save();

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    } else {
      payment.status = 'failed';
      payment.vnpayResponseCode = responseCode;
      payment.vnpayResponseMessage = vnpayService.getResponseMessage(responseCode);
      await payment.save();

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }
  } catch (error) {
    console.error('VNPay IPN error:', error);
    res.status(500).json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// ==================== PAYMENT HISTORY ====================

// Lấy lịch sử thanh toán
router.get('/history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ user: req.user._id })
      .populate('subscriptionPlan', 'name type price')
      .populate('coupon', 'code name type value')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Payment.countDocuments({ user: req.user._id });

    res.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử thanh toán' });
  }
});

// Lấy chi tiết thanh toán
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })
      .populate('subscriptionPlan')
      .populate('coupon')
      .lean();

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment detail error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết giao dịch' });
  }
});

// ==================== SUBSCRIPTION MANAGEMENT ====================

// Lấy thông tin subscription hiện tại
router.get('/subscription/current', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      user: req.user._id, 
      status: 'active' 
    })
      .populate('subscriptionPlan')
      .populate('payment')
      .lean();

    if (!subscription) {
      return res.json({ subscription: null });
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy thông tin đăng ký' });
  }
});

// Hủy subscription
router.post('/subscription/cancel', authenticate, [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Lý do hủy không được quá 500 ký tự')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason } = req.body;

    const subscription = await Subscription.findOne({ 
      user: req.user._id, 
      status: 'active' 
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Không tìm thấy đăng ký đang hoạt động' });
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;
    subscription.autoRenew = false;

    await subscription.save();

    res.json({ 
      message: 'Hủy đăng ký thành công',
      subscription 
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Lỗi server khi hủy đăng ký' });
  }
});

// ==================== UTILITIES ====================

// Lấy danh sách ngân hàng hỗ trợ
router.get('/banks/supported', async (req, res) => {
  try {
    const banks = vnpayService.getSupportedBanks();
    res.json({ banks });
  } catch (error) {
    console.error('Get supported banks error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách ngân hàng' });
  }
});

function sortObject(obj) {
	let sorted = {};
	let str = [];
	let key;
	for (key in obj){
		if (obj.hasOwnProperty(key)) {
		str.push(encodeURIComponent(key));
		}
	}
	str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

module.exports = router;
