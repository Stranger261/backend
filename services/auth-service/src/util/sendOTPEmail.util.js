import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.PASSWORD_USER,
  },
});

export const sendOTPEmail = async (receiverEmail, otp) => {
  const appName = 'HVill Hospital';
  const userName = 'User';
  const expiryMinutes = 10;
  const supportEmail = 'support@hvillhospital.com';
  const year = new Date().getFullYear();

  const htmlContent = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${appName} - One-time code</title>
    </head>
    <body style="font-family:system-ui,Segoe UI,Roboto,Arial;line-height:1.4;color:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center" style="padding:24px;">
            <table width="600" style="border-radius:8px;overflow:hidden;border:1px solid #e6edf3;" role="presentation">
              <tr>
                <td style="background:#0f172a;color:#fff;padding:20px 24px;">
                  <h1 style="margin:0;font-size:20px;">${appName}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 24px;background:#fff;">
                  <p style="margin:0 0 12px 0;">Hi ${userName},</p>
                  <p style="margin:0 0 20px 0;">Use the code below to complete your action. It expires in <strong>${expiryMinutes} minutes</strong>.</p>

                  <div style="display:inline-block;padding:18px 28px;border-radius:8px;background:#f3f7fb;font-size:22px;letter-spacing:4px;text-align:center;">
                    <strong>${otp}</strong>
                  </div>

                  <p style="margin:20px 0 0 0;color:#475569;font-size:14px;">
                    If you did not request this code, you can safely ignore this email or contact our support at <a href="mailto:${supportEmail}">${supportEmail}</a>.
                  </p>
                  <p style="margin:18px 0 0 0;font-size:13px;color:#94a3b8;">This is an automated message — please do not reply.</p>
                </td>
              </tr>
              <tr>
                <td style="background:#f8fafc;padding:12px 24px;font-size:12px;color:#64748b;">
                  © ${year} ${appName} • <a href="mailto:${supportEmail}">Support</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_USER}>`,
    to: receiverEmail,
    subject: 'Your verification code',
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
  console.log(`OTP email sent to ${receiverEmail}`);

  return { success: true, message: `OTP email sent to ${receiverEmail}` };
};
