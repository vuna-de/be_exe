const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: Number(EMAIL_PORT) === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('Email transporter chưa được cấu hình. Bỏ qua gửi email.');
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const info = await mailer.sendMail({ from, to, subject, html });
  return { messageId: info.messageId };
};

const sendVerificationEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = 'Xác thực tài khoản của bạn';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
      <h2>Chào mừng bạn đến với Gymnet</h2>
      <p>Vui lòng nhấp vào nút bên dưới để xác thực email và kích hoạt tài khoản của bạn.</p>
      <p><a href="${verifyLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Xác thực email</a></p>
      <p>Nếu nút không hoạt động, hãy copy liên kết sau vào trình duyệt:</p>
      <p><a href="${verifyLink}">${verifyLink}</a></p>
      <p>Liên kết có hiệu lực trong 24 giờ.</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendResetPasswordEmail = async (to, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = 'Đặt lại mật khẩu tài khoản của bạn';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
      <h2>Yêu cầu đặt lại mật khẩu</h2>
      <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Gymnet.</p>
      <p>Nhấp vào nút bên dưới để đặt lại mật khẩu của bạn.</p>
      <p><a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Đặt lại mật khẩu</a></p>
      <p>Nếu nút không hoạt động, hãy copy liên kết sau vào trình duyệt:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, có thể bỏ qua email này.</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendResetPasswordEmail
};


