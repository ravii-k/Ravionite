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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase function secrets." }, 500, corsHeaders);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_error) {
    return json({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "contact") {
      return await handleContact(req, adminClient, body, corsHeaders);
    }
    if (action === "admin_request") {
      return await handleAdminRequest(req, adminClient, body, corsHeaders);
    }
    if (action === "sample_chapter") {
      return await handleSampleChapter(req, adminClient, corsHeaders);
    }
    if (action === "latest_thoughts") {
      return await handleLatestThoughts(body, adminClient, corsHeaders);
    }
    return json({ error: "Unknown action." }, 400, corsHeaders);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500, corsHeaders);
  }
});

async function handleContact(req: Request, adminClient: ReturnType<typeof createClient>, body: Record<string, unknown>, corsHeaders: HeadersInit) {
  if (hasBotSignal(body, ["honeypot", "company", "website"])) {
    return json({ success: true, message: "Sent" }, 200, corsHeaders);
  }

  const name = normalizeSpaces(body.name, 120);
  const email = normalizeEmail(body.email);
  const message = normalizeMessage(body.message);
  const wordCount = countWords(message);

  if (name.length < 2) {
    return json({ error: "Enter a valid name." }, 400, corsHeaders);
  }
  if (!isValidEmail(email)) {
    return json({ error: "Enter a valid email address." }, 400, corsHeaders);
  }
  if (!message || wordCount < 1 || wordCount > 200 || message.length > 2400) {
    return json({ error: "Keep the message between 1 and 200 words." }, 400, corsHeaders);
  }

  const actorHash = await buildActorHash(req);
  const emailHash = await sha256(email);
  await enforceRateLimit(adminClient, {
    scope: "contact",
    actorHash,
    emailHash,
    actorLimit: 4,
    actorWindowMinutes: 15,
    emailLimit: 12,
    emailWindowMinutes: 1440
  });

  const insertResult = await adminClient.from("contact_messages").insert({
    name,
    email,
    message,
    source: "ravionite-website",
    actor_hash: actorHash
  });

  if (insertResult.error) {
    return json({ error: insertResult.error.message }, 400, corsHeaders);
  }

  await recordEvent(adminClient, "contact", actorHash, emailHash);
  return json({ success: true, message: "Sent" }, 200, corsHeaders);
}

async function handleAdminRequest(req: Request, adminClient: ReturnType<typeof createClient>, body: Record<string, unknown>, corsHeaders: HeadersInit) {
  if (hasBotSignal(body, ["honeypot", "website", "company"])) {
    return json({ success: true, message: "Request sent." }, 200, corsHeaders);
  }

  const requestedName = normalizeSpaces(body.display_name, 120);
  const requestedPhone = normalizePhone(body.phone);
  const requestedEmail = normalizeEmail(body.email);

  if (requestedName.length < 2) {
    return json({ error: "Enter a valid name." }, 400, corsHeaders);
  }
  if (!isValidPhone(requestedPhone)) {
    return json({ error: "Enter a valid phone number." }, 400, corsHeaders);
  }
  if (!isValidEmail(requestedEmail)) {
    return json({ error: "Enter a valid email address." }, 400, corsHeaders);
  }

  const actorHash = await buildActorHash(req);
  const emailHash = await sha256(requestedEmail);
  await enforceRateLimit(adminClient, {
    scope: "admin_request",
    actorHash,
    emailHash,
    actorLimit: 2,
    actorWindowMinutes: 1440,
    emailLimit: 2,
    emailWindowMinutes: 1440
  });

  const insertResult = await adminClient.from("admin_requests").insert({
    requested_name: requestedName,
    requested_email: requestedEmail,
    requested_phone: requestedPhone,
    actor_hash: actorHash
  });

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      return json({ error: "A request for this email is already in review." }, 409, corsHeaders);
    }
    return json({ error: insertResult.error.message }, 400, corsHeaders);
  }

  await recordEvent(adminClient, "admin_request", actorHash, emailHash);
  return json({ success: true, message: "Request sent." }, 200, corsHeaders);
}

async function handleSampleChapter(req: Request, adminClient: ReturnType<typeof createClient>, corsHeaders: HeadersInit) {
  const bucket = Deno.env.get("BOOK_SAMPLE_BUCKET") || "";
  const objectPath = Deno.env.get("BOOK_SAMPLE_PATH") || "";
  if (!bucket || !objectPath) {
    return json({ error: "Sample chapters are not connected to private storage yet." }, 503, corsHeaders);
  }

  const actorHash = await buildActorHash(req);
  await enforceRateLimit(adminClient, {
    scope: "sample_chapter",
    actorHash,
    emailHash: "",
    actorLimit: 8,
    actorWindowMinutes: 60,
    emailLimit: 0,
    emailWindowMinutes: 0
  });

  const signedUrlResult = await adminClient.storage.from(bucket).createSignedUrl(objectPath, 60 * 10);
  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    return json(
      { error: signedUrlResult.error ? signedUrlResult.error.message : "Could not open the sample chapters right now." },
      503,
      corsHeaders
    );
  }

  await recordEvent(adminClient, "sample_chapter", actorHash, null);
  return json({ success: true, url: signedUrlResult.data.signedUrl }, 200, corsHeaders);
}

async function handleLatestThoughts(body: Record<string, unknown>, adminClient: ReturnType<typeof createClient>, corsHeaders: HeadersInit) {
  const requestedLimit = Math.max(1, Math.min(Number(body.limit) || 12, 24));
  const result = await adminClient
    .from("thoughts")
    .select("id, body, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(requestedLimit);

  if (result.error) {
    return json({ error: result.error.message }, 400, corsHeaders);
  }

  return json({ success: true, thoughts: result.data || [] }, 200, corsHeaders);
}

async function enforceRateLimit(
  adminClient: ReturnType<typeof createClient>,
  options: {
    scope: string;
    actorHash: string;
    emailHash: string;
    actorLimit: number;
    actorWindowMinutes: number;
    emailLimit: number;
    emailWindowMinutes: number;
  }
) {
  if (options.actorLimit > 0) {
    const actorCount = await countRecentEvents(adminClient, options.scope, "actor_hash", options.actorHash, options.actorWindowMinutes);
    if (actorCount >= options.actorLimit) {
      throw new Error("Too many requests from this browser right now. Please wait a little and try again.");
    }
  }

  if (options.emailHash && options.emailLimit > 0) {
    const emailCount = await countRecentEvents(adminClient, options.scope, "email_hash", options.emailHash, options.emailWindowMinutes);
    if (emailCount >= options.emailLimit) {
      throw new Error("This email has hit the current request limit. Please try again later.");
    }
  }
}

async function countRecentEvents(
  adminClient: ReturnType<typeof createClient>,
  scope: string,
  column: "actor_hash" | "email_hash",
  value: string,
  windowMinutes: number
) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const result = await adminClient
    .from("public_submission_events")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq(column, value)
    .gte("created_at", since);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return typeof result.count === "number" ? result.count : 0;
}

async function recordEvent(adminClient: ReturnType<typeof createClient>, scope: string, actorHash: string, emailHash: string | null) {
  await adminClient.from("public_submission_events").insert({
    scope,
    actor_hash: actorHash,
    email_hash: emailHash || null
  });
}

function hasBotSignal(body: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => normalizePlain(body[key]) !== "");
}

function normalizePlain(value: unknown) {
  return String(value || "").trim();
}

function normalizeSpaces(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 32);
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function normalizeMessage(value: unknown) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 2400);
}

function countWords(value: string) {
  const matches = value.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

async function buildActorHash(req: Request) {
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const userAgent = req.headers.get("user-agent") || "unknown-agent";
  const origin = req.headers.get("Origin") || req.headers.get("Referer") || "unknown-origin";
  return await sha256([forwarded || "no-ip", userAgent, origin].join("|"));
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

function buildCorsHeaders(origin: string) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : defaultSiteOrigin;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

function json(payload: Record<string, unknown>, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}
