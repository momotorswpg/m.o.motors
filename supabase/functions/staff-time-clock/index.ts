import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const validDeviceId = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const hashDevice = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};
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
    const action = String(body?.action || "status"), deviceId = String(body?.device_id || "");
    if (!validDeviceId(deviceId)) return reply({ error:"This browser could not be identified. Refresh and try again." }, 400);
    const deviceHash = await hashDevice(deviceId), ip = requestIp(request);
    const userAgent = String(request.headers.get("user-agent") || "Unavailable").slice(0, 500);
    const isAdmin = ["owner", "admin"].includes(member.role);
    const { data:device } = await admin.from("office_clock_devices").select("id,label,active,approved_at,last_seen_at,last_seen_ip,last_seen_user_agent").eq("device_hash", deviceHash).maybeSingle();

    if (action === "status") return reply({ ok:true, approved:Boolean(device?.active), device:device || null, ip, user_agent:userAgent, can_approve:isAdmin });
    if (action === "approve_device") {
      if (!isAdmin) return reply({ error:"Administrator access required" }, 403);
      const label = String(body?.label || "Office computer").trim().slice(0, 80) || "Office computer";
      const { data, error } = await admin.from("office_clock_devices").upsert({ device_hash:deviceHash, label, active:true, approved_by:userId, approved_at:new Date().toISOString(), last_seen_at:new Date().toISOString(), last_seen_ip:ip, last_seen_user_agent:userAgent, updated_at:new Date().toISOString() }, { onConflict:"device_hash" }).select("id,label,active,approved_at,last_seen_ip,last_seen_user_agent").single();
      if (error) throw error;
      return reply({ ok:true, approved:true, device:data, ip, message:`${label} is approved for clock-ins.` });
    }
    if (action === "list_devices") {
      if (!isAdmin) return reply({ error:"Administrator access required" }, 403);
      const { data, error } = await admin.from("office_clock_devices").select("id,label,active,approved_at,last_seen_at,last_seen_ip,last_seen_user_agent").order("approved_at", { ascending:false });
      if (error) throw error;
      return reply({ ok:true, devices:data || [], current_device_id:device?.id || null, ip });
    }
    if (action === "set_device_active") {
      if (!isAdmin) return reply({ error:"Administrator access required" }, 403);
      const targetId = String(body?.target_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) return reply({ error:"Invalid device" }, 400);
      const { error } = await admin.from("office_clock_devices").update({ active:body?.active === true, updated_at:new Date().toISOString() }).eq("id", targetId);
      if (error) throw error;
      return reply({ ok:true, message:body?.active === true ? "Device reactivated." : "Device access removed." });
    }

    if (!device?.active) return reply({ error:"Clock-in is restricted to an approved office computer. Ask an administrator to approve this device." }, 403);
    await admin.from("office_clock_devices").update({ last_seen_at:new Date().toISOString(), last_seen_ip:ip, last_seen_user_agent:userAgent, updated_at:new Date().toISOString() }).eq("id", device.id);
    const now = new Date().toISOString();
    const { data:openShift, error:openError } = await admin.from("employee_timesheets").select("id,clock_in").eq("employee_id", userId).is("clock_out", null).maybeSingle();
    if (openError) throw openError;
    if (action === "clock_in") {
      if (openShift) return reply({ error:"You are already clocked in." }, 409);
      const { error } = await admin.from("employee_timesheets").insert({ employee_id:userId, clock_in:now, clock_in_ip:ip, clock_in_user_agent:userAgent, clock_in_device_id:device.id });
      if (error) throw error;
      return reply({ ok:true, message:"You are clocked in.", ip, device_label:device.label });
    }
    if (action === "clock_out") {
      if (!openShift) return reply({ error:"No open shift was found." }, 409);
      const { error } = await admin.from("employee_timesheets").update({ clock_out:now, clock_out_ip:ip, clock_out_user_agent:userAgent, clock_out_device_id:device.id, updated_at:now }).eq("id", openShift.id).is("clock_out", null);
      if (error) throw error;
      return reply({ ok:true, message:"You are clocked out.", ip, device_label:device.label });
    }
    return reply({ error:"Unsupported action" }, 400);
  } catch (error) {
    return reply({ error:error instanceof Error ? error.message : "Unable to update time clock" }, 500);
  }
});
