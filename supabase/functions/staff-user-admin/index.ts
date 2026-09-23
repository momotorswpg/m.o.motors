import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const cleanEmail = (value: unknown) => String(value || "").trim().toLowerCase();

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Staff account service is not configured");
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Invalid session" }, 401);
    const callerId = authData.user.id;
    const { data: caller } = await admin.from("staff_members").select("role,active").eq("user_id", callerId).maybeSingle();
    if (!caller?.active || !["owner", "admin"].includes(caller.role)) return reply({ error: "Administrator access required" }, 403);

    const body = await request.json();
    const action = String(body?.action || "");
    if (action === "invite") {
      const email = cleanEmail(body.email), displayName = String(body.display_name || "").trim();
      const role = body.role === "admin" ? "admin" : "sales";
      const hourlyWage = Math.max(0, Number(body.hourly_wage) || 0);
      if (!displayName || !/^\S+@\S+\.\S+$/.test(email)) return reply({ error: "Enter a valid name and email" }, 400);
      const redirectTo = "https://www.momotors.ca/admin-reset-password.html";
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo });
      if (error) return reply({ error: error.message }, 400);
      const userId = data.user?.id;
      if (!userId) throw new Error("The invitation did not return a user account");
      const { error: memberError } = await admin.from("staff_members").upsert({ user_id:userId, display_name:displayName, email, role, active:true, hourly_wage:hourlyWage, updated_at:new Date().toISOString() });
      if (memberError) {
        await admin.auth.admin.deleteUser(userId);
        throw memberError;
      }
      return reply({ ok:true, message:`Invitation sent to ${email}` });
    }

    const userId = String(body?.user_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "Invalid employee account" }, 400);
    const { data: member } = await admin.from("staff_members").select("email,role,active").eq("user_id", userId).maybeSingle();
    if (!member) return reply({ error: "Employee account not found" }, 404);

    if (action === "update") {
      const email = cleanEmail(body.email), displayName = String(body.display_name || "").trim();
      const role = body.role === "admin" ? "admin" : "sales";
      const active = body.active !== false, hourlyWage = Math.max(0, Number(body.hourly_wage) || 0);
      if (!displayName || !/^\S+@\S+\.\S+$/.test(email)) return reply({ error: "Enter a valid name and email" }, 400);
      if (userId === callerId && (!active || !["owner", "admin"].includes(role))) return reply({ error: "You cannot remove your own administrator access" }, 400);
      const authUpdates: Record<string, unknown> = { ban_duration: active ? "none" : "876000h" };
      if (email !== member.email) authUpdates.email = email;
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, authUpdates);
      if (updateAuthError) return reply({ error: updateAuthError.message }, 400);
      const storedRole = userId === callerId && member.role === "owner" ? "owner" : role;
      const { error: updateMemberError } = await admin.from("staff_members").update({ display_name:displayName, email, role:storedRole, active, hourly_wage:hourlyWage, updated_at:new Date().toISOString() }).eq("user_id", userId);
      if (updateMemberError) throw updateMemberError;
      return reply({ ok:true, message:"Employee account updated" });
    }

    if (action === "reset_password") {
      const email = cleanEmail(member.email);
      if (!email) return reply({ error: "This employee does not have an email address" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo:"https://www.momotors.ca/admin-reset-password.html" });
      if (error) return reply({ error: error.message }, 400);
      return reply({ ok:true, message:`Password reset sent to ${email}` });
    }

    return reply({ error: "Unsupported action" }, 400);
  } catch (error) {
    return reply({ error:error instanceof Error ? error.message : "Unable to manage employee" }, 500);
  }
});
