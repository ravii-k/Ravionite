import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultSiteOrigin = Deno.env.get("SITE_ORIGIN") || "https://ravii-k.github.io";
const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_SITE_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .concat([defaultSiteOrigin, "http://localhost:8000", "http://127.0.0.1:8000"])
);

Deno.serve(async function (req) {
  const origin = req.headers.get("Origin") || "";
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origin not allowed." }, 403, corsHeaders);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase function secrets." }, 500, corsHeaders);
  }

  if (!authHeader) {
    return json({ error: "Missing authorization header." }, 401, corsHeaders);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const token = authHeader.replace("Bearer ", "");
  const userResult = await userClient.auth.getUser(token);
  const user = userResult.data ? userResult.data.user : null;
  if (userResult.error || !user) {
    return json({ error: "Invalid admin session." }, 401, corsHeaders);
  }

  const callerResult = await userClient
    .from("admin_users")
    .select("user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (callerResult.error || !callerResult.data) {
    return json({ error: "Only approved admins can manage requests." }, 403, corsHeaders);
  }

  let body = null;
  try {
    body = await req.json();
  } catch (_error) {
    return json({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";

  if (!["approve", "delete"].includes(action) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return json({ error: "Invalid request action." }, 400, corsHeaders);
  }

  const requestResult = await adminClient
    .from("admin_requests")
    .select("id, requested_name, requested_email, requested_phone, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestResult.error) {
    return json({ error: requestResult.error.message }, 400, corsHeaders);
  }

  const requestRow = requestResult.data;
  if (!requestRow) {
    return json({ error: "Request not found." }, 404, corsHeaders);
  }

  if (requestRow.status !== "pending") {
    return json({ error: "This request is no longer pending." }, 409, corsHeaders);
  }

  if (action === "delete") {
    const deleteResult = await adminClient
      .from("admin_requests")
      .update({
        status: "deleted",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_note: "deleted by admin"
      })
      .eq("id", requestId);

    if (deleteResult.error) {
      return json({ error: deleteResult.error.message }, 400, corsHeaders);
    }

    return json({ success: true, action: "delete", requestId }, 200, corsHeaders);
  }

  const existingUser = await findUserByEmail(adminClient, requestRow.requested_email);
  const metadata = buildUserMetadata(requestRow.requested_name, requestRow.requested_phone);
  let approvedUserId = "";
  let mode = "existing";

  if (existingUser) {
    const updateUserResult = await adminClient.auth.admin.updateUserById(existingUser.id, {
      user_metadata: Object.assign({}, existingUser.user_metadata || {}, metadata),
      email_confirm: true
    });

    if (updateUserResult.error) {
      return json({ error: updateUserResult.error.message }, 400, corsHeaders);
    }

    approvedUserId = existingUser.id;
  } else {
    const inviteOptions = { data: metadata };
    const inviteRedirect = buildInviteRedirect(req);
    if (inviteRedirect) {
      inviteOptions.redirectTo = inviteRedirect;
    }

    const inviteResult = await adminClient.auth.admin.inviteUserByEmail(requestRow.requested_email, inviteOptions);
    if (inviteResult.error) {
      if (/rate limit/i.test(inviteResult.error.message)) {
        return json({ error: "Supabase email delivery is rate-limited right now. Wait a little and approve again." }, 429, corsHeaders);
      }
      return json({ error: inviteResult.error.message }, 400, corsHeaders);
    }

    const invitedUser = inviteResult.data?.user || await findUserByEmail(adminClient, requestRow.requested_email);
    if (!invitedUser || !invitedUser.id) {
      return json({ error: "Supabase did not return a user id for the approved request." }, 500, corsHeaders);
    }

    approvedUserId = invitedUser.id;
    mode = "invited";
  }

  const adminUpsert = await adminClient
    .from("admin_users")
    .upsert({
      user_id: approvedUserId,
      email: requestRow.requested_email,
      display_name: requestRow.requested_name,
      phone: requestRow.requested_phone
    }, { onConflict: "user_id" });

  if (adminUpsert.error) {
    return json({ error: adminUpsert.error.message }, 400, corsHeaders);
  }

  const requestUpdate = await adminClient
    .from("admin_requests")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      approved_user_id: approvedUserId,
      resolution_note: mode === "invited" ? "sent invite email and approved admin" : "promoted existing auth user"
    })
    .eq("id", requestId);

  if (requestUpdate.error) {
    return json({ error: requestUpdate.error.message }, 400, corsHeaders);
  }

  return json({
    success: true,
    action: "approve",
    requestId,
    email: requestRow.requested_email,
    mode,
    userId: approvedUserId
  }, 200, corsHeaders);
});

function buildInviteRedirect(req) {
  const explicit = normalizeUrl(Deno.env.get("ADMIN_VAULT_URL") || "");
  if (explicit) return explicit;

  const referer = normalizeUrl(req.headers.get("Referer") || "");
  if (referer) return referer;

  const siteUrl = normalizeUrl(Deno.env.get("SITE_URL") || "");
  return siteUrl ? siteUrl + "/ops" : "";
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildUserMetadata(displayName, phone) {
  return {
    display_name: displayName,
    full_name: displayName,
    name: displayName,
    phone_number: phone,
    contact_phone: phone
  };
}

async function findUserByEmail(adminClient, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 5; page += 1) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      throw result.error;
    }

    const users = result.data ? result.data.users || [] : [];
    const match = users.find(function (item) {
      return String(item.email || "").trim().toLowerCase() === normalizedEmail;
    });

    if (match) return match;
    if (users.length < perPage) break;
  }

  return null;
}

function buildCorsHeaders(origin) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : defaultSiteOrigin;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin"
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}
