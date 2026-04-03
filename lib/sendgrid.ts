import { SENDGRID_CONFIG } from './sendgridConfig';

export async function sendPasswordResetCode(email: string, verificationCode: string) {
  if (!SENDGRID_CONFIG.apiKey) {
    throw new Error('SendGrid API key not configured. Set EXPO_PUBLIC_SENDGRID_API_KEY in .env or EAS env');
  }
  if (!SENDGRID_CONFIG.fromEmail?.trim()) {
    throw new Error('SendGrid from email not configured. Set EXPO_PUBLIC_SENDGRID_FROM_EMAIL in .env');
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset – AgriHydra</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #eef1ef; font-family: 'Roboto', Arial, sans-serif; color: #2c2c2c; }
    .outer { max-width: 560px; margin: 0 auto; padding: 28px 20px; }
    .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .head { background: #2d5a36; padding: 28px 24px; text-align: center; }
    .brand { font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; color: #fff; margin: 0; }
    .tagline { font-family: 'Roboto', sans-serif; font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.88); margin: 6px 0 0; letter-spacing: 0.02em; }
    .main { padding: 32px 28px; }
    .main p { font-family: 'Roboto', sans-serif; font-size: 15px; font-weight: 400; line-height: 1.6; color: #3d3d3d; margin: 0 0 22px; }
    .code-wrap { background: #f4f7f4; border: 1px solid #c5d9c5; border-radius: 10px; padding: 24px 20px; text-align: center; margin: 26px 0; }
    .code-label { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #2d5a36; margin-bottom: 10px; }
    .code { font-family: 'Roboto', sans-serif; font-size: 30px; font-weight: 500; letter-spacing: 0.22em; color: #2d5a36; margin: 8px 0; }
    .code-note { font-family: 'Roboto', sans-serif; font-size: 12px; font-weight: 400; color: #5c5c5c; margin-top: 10px; }
    .small { font-family: 'Roboto', sans-serif; font-size: 13px; font-weight: 400; color: #5c5c5c; line-height: 1.55; margin-top: 22px; padding-top: 20px; border-top: 1px solid #e8e8e8; }
    .foot { padding: 20px 28px; background: #f6f6f6; font-family: 'Roboto', sans-serif; font-size: 12px; font-weight: 400; color: #6b6b6b; text-align: center; border-top: 1px solid #e8e8e8; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="card">
      <div class="head">
        <h1 class="brand">AGRIHYDRA</h1>
        <p class="tagline">Smart Farming for String Beans</p>
      </div>
      <div class="main">
        <p>We got a request to reset the password for your AgriHydra account. Use the code below in the app to continue.</p>
        <div class="code-wrap">
          <div class="code-label">Verification code</div>
          <div class="code">${verificationCode}</div>
          <div class="code-note">Valid for 10 minutes</div>
        </div>
        <p class="small">Type the code exactly as shown. If you didn't request this, you can ignore this email; nothing was changed on your account.</p>
      </div>
      <div class="foot">AgriHydra · This is an automated message. Please do not reply.</div>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }], subject: 'Password Reset – AgriHydra' }],
      from: { email: SENDGRID_CONFIG.fromEmail, name: 'AgriHydra - Smart Farming for String Beans' },
      content: [
        { type: 'text/plain', value: `Password Reset – AgriHydra\n\nYour verification code: ${verificationCode}\n\nValid for 10 minutes. Enter it in the app to reset your password.\n\nIf you didn't request this, ignore this email.\n\n— AgriHydra\nThis is an automated message. Please do not reply.` },
        { type: 'text/html', value: htmlContent },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.errors?.map((e: { message?: string }) => e.message).join('; ') || text;
    } catch { /* keep text */ }
    throw new Error(`Failed to send verification code email: ${response.status} ${detail}`);
  }

  return { success: true };
}
