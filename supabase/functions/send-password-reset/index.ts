import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  generateSixDigitCode,
  hashPasswordResetCode,
} from "../_shared/password-reset.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESET_CODE_TTL_MS = 10 * 60 * 1000;

function htmlEmail(verificationCode: string): string {
  return `<!DOCTYPE html>
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
}

async function clearResetToken(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  await admin
    .from("user_profiles")
    .update({
      password_reset_code_hash: null,
      password_reset_expires_at: null,
    })
    .eq("email", email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; verificationCode?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const codeFromClient =
    typeof body.verificationCode === "string"
      ? body.verificationCode.trim()
      : "";

  if (!emailRaw) {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verificationCode = codeFromClient || generateSixDigitCode();

  const sendgridKey =
    Deno.env.get("SENDGRID_API_KEY")?.trim() ||
    Deno.env.get("EXPO_PUBLIC_SENDGRID_API_KEY")?.trim();
  const fromEmail =
    Deno.env.get("SENDGRID_FROM_EMAIL")?.trim() ||
    Deno.env.get("EXPO_PUBLIC_SENDGRID_FROM_EMAIL")?.trim();
  if (!sendgridKey || !fromEmail) {
    return new Response(
      JSON.stringify({
        error:
          "SendGrid is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL (or EXPO_PUBLIC_SENDGRID_* equivalents) as Edge Function secrets.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Supabase URL or service role key missing" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("email")
    .eq("email", emailRaw)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: "Unable to send email for this address" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const codeHash = await hashPasswordResetCode(emailRaw, verificationCode);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();

  const { error: saveError } = await admin
    .from("user_profiles")
    .update({
      password_reset_code_hash: codeHash,
      password_reset_expires_at: expiresAt,
    })
    .eq("email", emailRaw);

  if (saveError) {
    return new Response(
      JSON.stringify({
        error:
          `Could not save reset code: ${saveError.message}. Add columns password_reset_code_hash and password_reset_expires_at to user_profiles (see supabase/migrations).`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const plainText =
    `Password Reset – AgriHydra\n\nYour verification code: ${verificationCode}\n\nValid for 10 minutes. Enter it in the app to reset your password.\n\nIf you didn't request this, ignore this email.\n\n— AgriHydra\nThis is an automated message. Please do not reply.`;

  const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: profile.email as string }],
          subject: "Password Reset – AgriHydra",
        },
      ],
      from: {
        email: fromEmail,
        name: "AgriHydra - Smart Farming for String Beans",
      },
      content: [
        { type: "text/plain", value: plainText },
        { type: "text/html", value: htmlEmail(verificationCode) },
      ],
    }),
  });

  if (!sgResponse.ok) {
    await clearResetToken(admin, emailRaw);
    const text = await sgResponse.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as {
        errors?: Array<{ message?: string }>;
      };
      detail =
        json.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
        text;
    } catch {
      /* keep text */
    }
    return new Response(
      JSON.stringify({
        error: `SendGrid error: ${sgResponse.status} ${detail}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
