const express = require('express');
const { body, validationResult } = require('express-validator');
const vnpayService = require('../services/vnpayService');
const { Payment, Subscription } = require('../models/Payment');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const moment = require('moment');

const router = express.Router();

// ==================== VNPAY PAYMENT CREATION ====================

// Tạo URL thanh toán VNPay (theo chuẩn VNPay)
router.post('/create_payment_url', authenticate, [
  body('amount').isFloat({ min: 1000 }).withMessage('Số tiền phải ít nhất 1,000 VNĐ'),
  body('bankCode').optional().isString(),
  body('language').optional().isIn(['vn', 'en']).withMessage('Ngôn ngữ phải là vn hoặc en')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, bankCode, language = 'vn' } = req.body;

    // Tạo transaction ID theo format VNPay
    const date = new Date();
    const orderId = `GYM_${moment(date).format('DDHHmmss')}`;

    // Tạo payment record
    const payment = new Payment({
      user: req.user._id,
      amount: amount,
      currency: 'VND',
      paymentMethod: 'vnpay',
      transactionId: orderId,
      finalAmount: amount,
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 phút
    });

    await payment.save();

    // Tạo URL thanh toán VNPay
    const paymentData = {
      amount: amount,
      orderId: orderId,
      orderDescription: `Thanh toán gói Gymnet - ${orderId}`,
      orderType: 'other',
      bankCode: bankCode || '',
      language: language,
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
      message: 'Tạo URL thanh toán thành công',
      paymentUrl: vnpayResult.paymentUrl,
      transactionId: orderId,
      amount: amount
    });
  } catch (error) {
    console.error('Create VNPay URL error:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo URL thanh toán' });
  }
});

// ==================== VNPAY RETURN & IPN ====================

// Xử lý return URL từ VNPay
router.get('/vnpay_return', async (req, res) => {
  try {
    const vnp_Params = req.query;
    
    // Xác thực chữ ký
    const isValid = vnpayService.verifyReturnUrl(vnp_Params);
    
    if (!isValid) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=invalid_signature`);
    }

    const transactionId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const responseMessage = vnpayService.getResponseMessage(responseCode);

    // Tìm payment
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=payment_not_found`);
    }

    // Cập nhật trạng thái payment
    if (responseCode === '00') {
      payment.status = 'completed';
      payment.vnpayResponseCode = responseCode;
      payment.vnpayResponseMessage = responseMessage;
      payment.completedAt = new Date();
      await payment.save();

      // Thông báo thanh toán thành công
      createNotification({
        user: payment.user,
        type: 'payment',
        title: 'Thanh toán thành công',
        message: `Giao dịch ${transactionId} đã được thanh toán thành công`,
        data: { transactionId }
      });

      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?transactionId=${transactionId}`);
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

      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=${responseCode}&message=${encodeURIComponent(responseMessage)}`);
    }
  } catch (error) {
    console.error('VNPay return error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=server_error`);
  }
});

// Xử lý IPN từ VNPay
router.post('/vnpay_ipn', async (req, res) => {
  try {
    const vnp_Params = req.body;
    
    // Xác thực chữ ký
    const isValid = vnpayService.verifyIpn(vnp_Params);
    
    if (!isValid) {
      return res.status(400).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    const transactionId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount']) / 100; // VNPay trả về amount * 100

    // Tìm payment
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(400).json({ RspCode: '01', Message: 'Order not found' });
    }

    // Kiểm tra số tiền
    if (Math.abs(amount - payment.finalAmount) > 0.01) { // Cho phép sai số 1 cent
      return res.status(400).json({ RspCode: '04', Message: 'Amount invalid' });
    }

    // Kiểm tra trạng thái giao dịch trước khi cập nhật
    if (payment.status !== 'pending') {
      return res.status(200).json({ RspCode: '02', Message: 'This order has been updated to the payment status' });
    }

    // Cập nhật trạng thái payment
    if (responseCode === '00') {
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
      payment.failureReason = vnpayService.getResponseMessage(responseCode);
      await payment.save();

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }
  } catch (error) {
    console.error('VNPay IPN error:', error);
    res.status(500).json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// ==================== VNPAY QUERY & REFUND ====================

// Truy vấn giao dịch VNPay
router.post('/querydr', authenticate, [
  body('orderId').notEmpty().withMessage('Mã giao dịch là bắt buộc'),
  body('transDate').matches(/^\d{8}$/).withMessage('Ngày giao dịch phải có định dạng YYYYMMDD')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, transDate } = req.body;

    // Kiểm tra payment có thuộc về user không
    const payment = await Payment.findOne({ 
      transactionId: orderId, 
      user: req.user._id 
    });

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
    }

    const queryResult = await vnpayService.queryTransaction({ orderId, transDate });
    
    res.json({
      message: 'Truy vấn giao dịch thành công',
      result: queryResult
    });
  } catch (error) {
    console.error('Query transaction error:', error);
    res.status(500).json({ error: 'Lỗi server khi truy vấn giao dịch' });
  }
});

// Hoàn tiền giao dịch VNPay
router.post('/refund', authenticate, [
  body('orderId').notEmpty().withMessage('Mã giao dịch là bắt buộc'),
  body('transDate').matches(/^\d{8}$/).withMessage('Ngày giao dịch phải có định dạng YYYYMMDD'),
  body('amount').isFloat({ min: 0 }).withMessage('Số tiền hoàn phải lớn hơn 0'),
  body('transType').optional().isIn(['03', '04']).withMessage('Loại giao dịch không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, transDate, amount, transType = '03' } = req.body;

    // Kiểm tra payment có thuộc về user không và đã hoàn thành
    const payment = await Payment.findOne({ 
      transactionId: orderId, 
      user: req.user._id,
      status: 'completed'
    });

    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch hoặc giao dịch chưa hoàn thành' });
    }

    // Kiểm tra số tiền hoàn không vượt quá số tiền giao dịch
    if (amount > payment.finalAmount) {
      return res.status(400).json({ error: 'Số tiền hoàn không được vượt quá số tiền giao dịch' });
    }

    const refundResult = await vnpayService.refundTransaction({ 
      orderId, 
      transDate, 
      amount, 
      transType,
      user: req.user._id.toString()
    });

    // Cập nhật trạng thái payment
    payment.status = 'refunded';
    payment.refundAmount = amount;
    payment.refundedAt = new Date();
    payment.refundReason = 'User requested refund';
    await payment.save();

    // Thông báo hoàn tiền
    createNotification({
      user: req.user._id,
      type: 'payment',
      title: 'Hoàn tiền thành công',
      message: `Giao dịch ${orderId} đã được hoàn tiền ${amount.toLocaleString()} VNĐ`,
      data: { orderId, refundAmount: amount }
    });

    res.json({
      message: 'Hoàn tiền thành công',
      result: refundResult,
      refundAmount: amount
    });
  } catch (error) {
    console.error('Refund transaction error:', error);
    res.status(500).json({ error: 'Lỗi server khi hoàn tiền' });
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

module.exports = router;
