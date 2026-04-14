import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { hashPasswordResetCode } from "../_shared/password-reset.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  const verificationCode =
    typeof body.verificationCode === "string"
      ? body.verificationCode.trim()
      : "";

  if (!emailRaw || !verificationCode) {
    return new Response(
      JSON.stringify({ error: "email and verificationCode are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error } = await admin
    .from("user_profiles")
    .select("password_reset_code_hash, password_reset_expires_at")
    .eq("email", emailRaw)
    .maybeSingle();

  if (error || !row?.password_reset_code_hash || !row.password_reset_expires_at) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expires = new Date(row.password_reset_expires_at as string).getTime();
  if (Number.isNaN(expires) || Date.now() > expires) {
    return new Response(JSON.stringify({ valid: false, reason: "expired" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectedHash = row.password_reset_code_hash as string;
  const actualHash = await hashPasswordResetCode(emailRaw, verificationCode);
  const valid = expectedHash === actualHash;

  return new Response(JSON.stringify({ valid }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
