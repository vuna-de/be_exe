const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment');

class VNPayService {
  constructor() {
    this.vnp_TmnCode = process.env.VNPAY_TMN_CODE || '2QXUI4J4';
    this.vnp_HashSecret = process.env.VNPAY_HASH_SECRET || 'RAOEXHYVSDDIIENYWSLDKIYWDSFLDSHY';
    this.vnp_Url = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    this.vnp_ReturnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:5000/api/payment/vnpay/return';
    this.vnp_IpnUrl = process.env.VNPAY_IPN_URL || 'http://localhost:5000/api/payment/vnpay-ipn';
    this.vnp_Version = '2.1.0';
    this.vnp_Command = 'pay';
    this.vnp_CurrCode = 'VND';
    this.vnp_Locale = 'vn';
  }

  // Tạo URL thanh toán VNPay
  createPaymentUrl(paymentData, req) {
    const {
      amount,
      orderId,
      orderDescription,
      orderType = 'other',
      bankCode = '',
      language = 'vn',
      // ipAddr = '127.0.0.1'
    } = paymentData;

    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    
    let tmnCode = this.vnp_TmnCode;
    let secretKey = this.vnp_HashSecret;
    let vnpUrl = this.vnp_Url;
    let returnUrl = this.vnp_ReturnUrl;
    
    let locale = req.body.language;
    if(locale === null || locale === ''){
        locale = 'vn';
    }
    let currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if(bankCode !== null && bankCode !== ''){
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = this.sortObject(vnp_Params);

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
    // // Sắp xếp tham số theo thứ tự alphabet (theo chuẩn VNPay)
    // const sortedParams = this.sortObject(vnp_Params);

    // // Tạo chuỗi ký (không encode)
    // const signData = qs.stringify(sortedParams, { encode: false });
    
    // // Tạo chữ ký HMAC SHA512
    // const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
    // const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    // // Thêm chữ ký vào params
    // sortedParams['vnp_SecureHash'] = signed;
    
    // Tạo URL thanh toán (không encode)
    // const paymentUrl = this.vnp_Url + '?' + qs.stringify(this.sortedParams, { encode: false });
    
    return {
      paymentUrl: vnpUrl,
      transactionId: orderId,
      amount,
      returnUrl: this.vnp_ReturnUrl,
      ipnUrl: this.vnp_IpnUrl
    };
  }

  sortObject(obj) {
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
  // Xác thực kết quả thanh toán từ VNPay
  verifyReturnUrl(vnp_Params) {
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnp_Params);
    const signData = qs.stringify(sortedParams, { encode: false });
    
    const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    return secureHash === signed;
  }

  // Xác thực IPN từ VNPay
  verifyIpn(vnp_Params) {
    const secureHash = vnp_Params['vnp_SecureHash'];
    
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnp_Params);
    const signData = qs.stringify(sortedParams, { encode: false });
    
    const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    return secureHash === signed;
  }

  // Sắp xếp object theo thứ tự alphabet (theo chuẩn VNPay)
  sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
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

  // Lấy IP địa chỉ từ request
  getIpAddress(req) {
    return req.headers['x-forwarded-for'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.connection.socket.remoteAddress;
  }

  // Lấy danh sách ngân hàng hỗ trợ
  getSupportedBanks() {
    return [
      { code: 'NCB', name: 'Ngân hàng Quốc Dân (NCB)' },
      { code: 'SACOMBANK', name: 'Ngân hàng Sài Gòn Thương Tín (SacomBank)' },
      { code: 'EXIMBANK', name: 'Ngân hàng Xuất Nhập Khẩu Việt Nam (EximBank)' },
      { code: 'MSBANK', name: 'Ngân hàng Hàng Hải (MSBANK)' },
      { code: 'NAMABANK', name: 'Ngân hàng Nam Á (NamABank)' },
      { code: 'OCB', name: 'Ngân hàng Phương Đông (OCB)' },
      { code: 'IVB', name: 'Ngân hàng TNHH Indovina (IVB)' },
      { code: 'VISA', name: 'Thanh toán qua VISA/MASTER' },
      { code: 'VNMART', name: 'Ví điện tử VnMart' },
      { code: 'VIETINBANK', name: 'Ngân hàng Công thương Việt Nam (VietinBank)' },
      { code: 'VIETCOMBANK', name: 'Ngân hàng Ngoại thương Việt Nam (Vietcombank)' },
      { code: 'HDBANK', name: 'Ngân hàng Phát triển TP.HCM (HDBank)' },
      { code: 'DONGABANK', name: 'Ngân hàng Đông Á (DongABank)' },
      { code: 'TPBANK', name: 'Ngân hàng Tiên Phong (TPBank)' },
      { code: 'OJB', name: 'Ngân hàng Đại Dương (OceanBank)' },
      { code: 'BIDV', name: 'Ngân hàng Đầu tư và Phát triển Việt Nam (BIDV)' },
      { code: 'TECHCOMBANK', name: 'Ngân hàng Kỹ thương Việt Nam (Techcombank)' },
      { code: 'VIETBANK', name: 'Ngân hàng Việt Nam Thương Tín (VietBank)' },
      { code: 'VIETABANK', name: 'Ngân hàng Việt Á (VietABank)' },
      { code: 'ACB', name: 'Ngân hàng Á Châu (ACB)' },
      { code: 'HCM', name: 'Ngân hàng Phát triển TP.HCM (HDBank)' },
      { code: 'VCCB', name: 'Ngân hàng Bản Việt (VietCapitalBank)' },
      { code: 'VIB', name: 'Ngân hàng Quốc tế Việt Nam (VIB)' },
      { code: 'SHB', name: 'Ngân hàng Sài Gòn - Hà Nội (SHB)' }
    ];
  }

  // Lấy thông tin response code
  getResponseMessage(responseCode) {
    const responseMessages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking',
      '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Đã hết hạn chờ thanh toán. Xin vui lòng thực hiện lại giao dịch',
      '12': 'Giao dịch bị hủy',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Giao dịch không thành công do: Nhập sai mật khẩu thanh toán quá số lần quy định',
      '99': 'Các lỗi khác (lỗi còn lại, có thể liên hệ ngân hàng để kiểm tra)'
    };

    return responseMessages[responseCode] || 'Lỗi không xác định';
  }
}

module.exports = new VNPayService();