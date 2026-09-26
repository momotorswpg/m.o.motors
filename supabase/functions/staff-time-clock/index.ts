import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const requestIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") || forwarded || request.headers.get("x-real-ip") || "Unavailable";
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Time clock service is not configured");
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required" }, 401);
    const admin = createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:authData, error:authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error:"Invalid session" }, 401);
    const userId = authData.user.id;
    const { data:member, error:memberError } = await admin.from("staff_members").select("role,active,display_name").eq("user_id", userId).maybeSingle();
    if (memberError) throw memberError;
    if (!member) return reply({ error:"This login is not connected to a staff account." }, 403);
    if (member.active === false) return reply({ error:"This staff account is inactive." }, 403);

    const body = await request.json();
    const action = String(body?.action || "status"), ip = requestIp(request);
    const userAgent = String(request.headers.get("user-agent") || "Unavailable").slice(0, 500);

    if (action === "status") return reply({ ok:true, ip, user_agent:userAgent });
    const now = new Date().toISOString();
    const { data:openShift, error:openError } = await admin.from("employee_timesheets").select("id,clock_in").eq("employee_id", userId).is("clock_out", null).maybeSingle();
    if (openError) throw openError;
    if (action === "clock_in") {
      if (openShift) return reply({ error:"You are already clocked in." }, 409);
      const { error } = await admin.from("employee_timesheets").insert({ employee_id:userId, clock_in:now, clock_in_ip:ip, clock_in_user_agent:userAgent });
      if (error) throw error;
      return reply({ ok:true, message:"You are clocked in.", ip });
    }
    if (action === "clock_out") {
      if (!openShift) return reply({ error:"No open shift was found." }, 409);
      const { error } = await admin.from("employee_timesheets").update({ clock_out:now, clock_out_ip:ip, clock_out_user_agent:userAgent, updated_at:now }).eq("id", openShift.id).is("clock_out", null);
      if (error) throw error;
      return reply({ ok:true, message:"You are clocked out.", ip });
    }
    return reply({ error:"Unsupported action" }, 400);
  } catch (error) {
    return reply({ error:error instanceof Error ? error.message : "Unable to update time clock" }, 500);
  }
});
