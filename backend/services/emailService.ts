import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTP = async (to: string, otp: string) => {
  const isPlaceholder = !process.env.EMAIL_USER || 
                        !process.env.EMAIL_PASS || 
                        process.env.EMAIL_USER.includes('your-email') || 
                        process.env.EMAIL_PASS.includes('your-app-password');

  if (isPlaceholder) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not configured or using placeholders. OTP email skipped.');
    console.log('-----------------------------------------');
    console.log(`[DEVELOPMENT] OTP for ${to}: ${otp}`);
    console.log('-----------------------------------------');
    return;
  }

  const mailOptions = {
    from: `"NHMS Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your NHMS Verification Code',
    text: `Your One Time Password (OTP) for NHMS registration is: ${otp}\n\nThis code will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333 text-align: center;">Verify Your Email</h2>
        <p style="font-size: 16px; color: #555;">Hello,</p>
        <p style="font-size: 16px; color: #555;">Thank you for registering on the National Highway Management System. Please use the following One Time Password (OTP) to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; background-color: #f4f4f4; padding: 10px 20px; border-radius: 5px; letter-spacing: 5px; color: #000;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP Email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

export const sendPasswordResetOTP = async (to: string, otp: string) => {
  const isPlaceholder = !process.env.EMAIL_USER || 
                        !process.env.EMAIL_PASS || 
                        process.env.EMAIL_USER.includes('your-email') || 
                        process.env.EMAIL_PASS.includes('your-app-password');

  if (isPlaceholder) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not configured or using placeholders. Reset OTP email skipped.');
    console.log('-----------------------------------------');
    console.log(`[DEVELOPMENT] Password Reset OTP for ${to}: ${otp}`);
    console.log('-----------------------------------------');
    return;
  }

  const mailOptions = {
    from: `"NHMS Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'NHMS Password Reset Verification Code',
    text: `Your One Time Password (OTP) for resetting your NHMS password is: ${otp}\n\nThis code will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
        <p style="font-size: 16px; color: #555;">Hello,</p>
        <p style="font-size: 16px; color: #555;">You requested a password reset for your National Highway Management System account. Please use the following One Time Password (OTP) to complete the process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; background-color: #f4f4f4; padding: 10px 20px; border-radius: 5px; letter-spacing: 5px; color: #000;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Reset OTP Email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending reset OTP email:', error);
    throw new Error('Failed to send reset OTP email');
  }
};
