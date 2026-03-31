import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async function (req) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase function secrets." }, 500);
  }

  if (!authHeader) {
    return json({ error: "Missing authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const token = authHeader.replace("Bearer ", "");
  const userResult = await userClient.auth.getUser(token);
  const user = userResult.data ? userResult.data.user : null;
  if (userResult.error || !user) {
    return json({ error: "Invalid admin session." }, 401);
  }

  const callerResult = await userClient
    .from("admin_users")
    .select("user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (callerResult.error || !callerResult.data) {
    return json({ error: "Only approved admins can manage requests." }, 403);
  }

  let body = null;
  try {
    body = await req.json();
  } catch (_error) {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";

  if (!["approve", "delete"].includes(action) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return json({ error: "Invalid request action." }, 400);
  }

  const requestResult = await adminClient
    .from("admin_requests")
    .select("id, requested_name, requested_email, requested_phone, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestResult.error) {
    return json({ error: requestResult.error.message }, 400);
  }

  const requestRow = requestResult.data;
  if (!requestRow) {
    return json({ error: "Request not found." }, 404);
  }

  if (requestRow.status !== "pending") {
    return json({ error: "This request is no longer pending." }, 409);
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
      return json({ error: deleteResult.error.message }, 400);
    }

    return json({ success: true, action: "delete", requestId: requestId });
  }

  const existingUser = await findUserByEmail(adminClient, requestRow.requested_email);
  const metadata = buildUserMetadata(requestRow.requested_name, requestRow.requested_phone);
  let approvedUserId = "";
  let tempPassword = null;
  let mode = "existing";

  if (existingUser) {
    const updateUserResult = await adminClient.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      user_metadata: Object.assign({}, existingUser.user_metadata || {}, metadata)
    });

    if (updateUserResult.error) {
      return json({ error: updateUserResult.error.message }, 400);
    }

    approvedUserId = existingUser.id;
  } else {
    tempPassword = generateTempPassword();
    const createUserResult = await adminClient.auth.admin.createUser({
      email: requestRow.requested_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: metadata
    });

    if (createUserResult.error) {
      return json({ error: createUserResult.error.message }, 400);
    }

    const createdUser = createUserResult.data ? createUserResult.data.user : null;
    if (!createdUser || !createdUser.id) {
      return json({ error: "Supabase did not return a user id for the approved request." }, 500);
    }

    approvedUserId = createdUser.id;
    mode = "created";
  }

  const adminUpsert = await adminClient
    .from("admin_users")
    .upsert({
      user_id: approvedUserId,
      email: requestRow.requested_email,
      display_name: requestRow.requested_name,
      phone: requestRow.requested_phone
    }, {
      onConflict: "user_id"
    });

  if (adminUpsert.error) {
    return json({ error: adminUpsert.error.message }, 400);
  }

  const requestUpdate = await adminClient
    .from("admin_requests")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      approved_user_id: approvedUserId,
      resolution_note: mode === "created" ? "created new auth user" : "promoted existing auth user"
    })
    .eq("id", requestId);

  if (requestUpdate.error) {
    return json({ error: requestUpdate.error.message }, 400);
  }

  return json({
    success: true,
    action: "approve",
    requestId: requestId,
    email: requestRow.requested_email,
    mode: mode,
    tempPassword: tempPassword,
    userId: approvedUserId
  });
});

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
    const result = await adminClient.auth.admin.listUsers({ page: page, perPage: perPage });
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

function generateTempPassword() {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return "Rv!" + raw.slice(0, 5) + raw.slice(5, 10).toUpperCase() + "7#";
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: Object.assign({}, corsHeaders, {
      "Content-Type": "application/json"
    })
  });
}
