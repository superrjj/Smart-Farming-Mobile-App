import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type WebhookBody = {
  record?: { date_key?: string; text?: string };
  date_key?: string;
  text?: string;
};

function getRemarkFromBody(body: WebhookBody): { dateKey: string; text: string } | null {
  const dateKey = String(body.record?.date_key ?? body.date_key ?? "").trim();
  const text = String(body.record?.text ?? body.text ?? "").trim();
  if (!dateKey || !text) return null;
  return { dateKey, text };
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
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

  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const remark = getRemarkFromBody(body);
  if (!remark) {
    return new Response(JSON.stringify({ error: "date_key and text are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = parseDateKey(remark.dateKey);
  if (!parsed) {
    return new Response(JSON.stringify({ error: "Invalid date_key format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  const { data: scheduleRows, error: scheduleError } = await admin
    .from("irrigation_scheduled_dates")
    .select("schedule_id")
    .eq("year", parsed.year)
    .eq("month", parsed.month)
    .eq("day", parsed.day);

  if (scheduleError) {
    return new Response(JSON.stringify({ error: scheduleError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const scheduleIds = [...new Set((scheduleRows ?? []).map((row) => String(row.schedule_id)))];
  if (scheduleIds.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: userRows, error: userError } = await admin
    .from("irrigation_schedules")
    .select("user_id")
    .in("id", scheduleIds);

  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userIds = [...new Set((userRows ?? []).map((row) => String(row.user_id)))];
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tokenRows, error: tokenError } = await admin
    .from("user_push_tokens")
    .select("token")
    .in("user_id", userIds)
    .eq("platform", "expo");

  if (tokenError) {
    return new Response(JSON.stringify({ error: tokenError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokens = [...new Set((tokenRows ?? []).map((row) => String(row.token)).filter(Boolean))];
  if (tokens.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pushMessages = tokens.map((to) => ({
    to,
    title: "Admin Remark",
    body: remark.text,
    sound: "default",
    data: {
      type: "admin_remark",
      date_key: remark.dateKey,
    },
  }));

  const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pushMessages),
  });

  const expoBody = await expoRes.text();
  if (!expoRes.ok) {
    return new Response(
      JSON.stringify({
        error: `Expo push error: ${expoRes.status} ${expoBody}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true, sent: tokens.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

