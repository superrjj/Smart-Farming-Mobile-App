import { SENDGRID_CONFIG } from './sendgridConfig';

export async function sendPasswordResetCode(email: string, verificationCode: string) {
  if (!SENDGRID_CONFIG.apiKey) {
    throw new Error('SendGrid API key not configured');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Verification Code</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          background: linear-gradient(135deg, #3E9B4F 0%, #2d7a3a 100%);
          padding: 40px 30px;
          text-align: center;
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/></svg>');
          opacity: 0.3;
        }
        .logo {
          position: relative;
          z-index: 1;
        }
        .logo-icon {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.95);
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .logo-icon img {
          width: 70px;
          height: 70px;
          object-fit: contain;
        }
        .logo-text {
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .header-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.9);
          font-weight: 500;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }
        .message {
          font-size: 15px;
          color: #4a4a4a;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .code-section {
          background: linear-gradient(135deg, #f8fffe 0%, #e8f5f0 100%);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
          border: 2px solid #3E9B4F;
          position: relative;
          overflow: hidden;
        }
        .code-section::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(62,155,79,0.1) 0%, transparent 70%);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .code-label {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #3E9B4F;
          font-weight: 600;
          margin-bottom: 15px;
          position: relative;
          z-index: 1;
        }
        .code {
          font-size: 42px;
          font-weight: 800;
          color: #3E9B4F;
          letter-spacing: 12px;
          margin: 15px 0;
          font-family: 'Courier New', monospace;
          text-shadow: 0 2px 4px rgba(62,155,79,0.2);
          position: relative;
          z-index: 1;
        }
        .code-hint {
          font-size: 13px;
          color: #666;
          margin-top: 15px;
          position: relative;
          z-index: 1;
        }
        .info-box {
          background: #fff9e6;
          border-left: 4px solid #ffc107;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .info-box-title {
          font-size: 14px;
          font-weight: 700;
          color: #e67e00;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .info-list {
          list-style: none;
          padding: 0;
        }
        .info-list li {
          font-size: 14px;
          color: #666;
          padding: 8px 0;
          padding-left: 25px;
          position: relative;
        }
        .info-list li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #3E9B4F;
          font-weight: bold;
        }
        .warning-box {
          background: #fff3f3;
          border: 2px solid #ef5350;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .warning-content {
          width: 100%;
        }
        .warning-title {
          font-size: 14px;
          font-weight: 700;
          color: #c62828;
          margin-bottom: 8px;
        }
        .warning-text {
          font-size: 14px;
          color: #666;
          line-height: 1.6;
        }
        .footer {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer-text {
          font-size: 13px;
          color: #868e96;
          line-height: 1.8;
        }
        .footer-links {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        .footer-link {
          color: #3E9B4F;
          text-decoration: none;
          font-size: 13px;
          margin: 0 10px;
          font-weight: 500;
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 20px 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .code {
            font-size: 36px;
            letter-spacing: 8px;
          }
          .logo-text {
            font-size: 22px;
          }
          .warning-box {
            padding: 15px;
          }
          .warning-title {
            font-size: 13px;
          }
          .warning-text {
            font-size: 13px;
          }
          .info-box {
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <div class="logo">
              <div class="logo-text">AgriHydra</div>
              <div class="header-subtitle">Smart Farming for String Beans</div>
            </div>
          </div>
          
          <div class="content">
            <div class="greeting">Hello! 👋</div>
            
            <p class="message">
              We received a request to reset the password for your AgriHydra account. 
              Use the verification code below to proceed with resetting your password.
            </p>
            
            <div class="code-section">
              <div class="code-label">Your Verification Code</div>
              <div class="code">${verificationCode}</div>
              <div class="code-hint">Enter this code in the app to continue</div>
            </div>
            
            <div class="info-box">
              <div class="info-box-title">
                <span>⏱️</span>
                <span>Important Information</span>
              </div>
              <ul class="info-list">
                <li>This code will expire in <strong>10 minutes</strong></li>
                <li>Enter the code exactly as shown above</li>
                <li>Keep this code confidential and do not share it</li>
                <li>If you didn't request this, you can safely ignore this email</li>
              </ul>
            </div>
            
            <div class="warning-box">
              <div class="warning-content">
                <div class="warning-title">Security Notice</div>
                <div class="warning-text">
                  If you didn't request a password reset, please ignore this email. 
                  Your account remains secure and no changes have been made.
                </div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p class="footer-text">
              This is an automated message from Beanly.<br>
              Please do not reply to this email.
            </p>
            <div class="footer-links">
              <a href="#" class="footer-link">Help Center</a>
              <a href="#" class="footer-link">Contact Support</a>
              <a href="#" class="footer-link">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        subject: 'Password Reset Verification Code - AgriHydra',
      }],
      from: { 
        email: SENDGRID_CONFIG.fromEmail,
        name: 'AgriHydra'
      },
      content: [
        {
          type: 'text/plain',
          value: `Password Reset Verification Code\n\nYour verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.\n\nImportant:\n- Enter this code in the app to reset your password\n- Do not share this code with anyone\n- If you didn't request this, please ignore this email\n\n---\nBeanly\nThis is an automated message. Please do not reply.`,
        },
        {
          type: 'text/html',
          value: htmlContent,
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send verification code email');
  }

  return { success: true };
}