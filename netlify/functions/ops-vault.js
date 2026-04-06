const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const COOKIE_NAME = "ravionite_ops_gate";
const TEMPLATE_PATH = path.resolve(__dirname, "../../ops-vault-template.html");

exports.handler = async function (event) {
  if (event.httpMethod === "POST") {
    return handleGateSubmit(event);
  }

  if (event.httpMethod !== "GET") {
    return respond(405, "Method not allowed.", { "Content-Type": "text/plain; charset=utf-8" });
  }

  if (hasValidGateCookie(event.headers.cookie || "")) {
    return serveVault();
  }

  return {
    statusCode: 401,
    headers: buildHtmlHeaders(),
    body: renderGatePage("")
  };
};

function handleGateSubmit(event) {
  const accessPhrase = getAccessPhrase();
  if (!accessPhrase) {
    return {
      statusCode: 500,
      headers: buildHtmlHeaders(),
      body: renderGatePage("OPS_VAULT_PASSPHRASE is missing in Netlify environment variables.")
    };
  }

  const params = new URLSearchParams(event.body || "");
  const submitted = String(params.get("access_phrase") || "").trim();
  if (!submitted || submitted !== accessPhrase) {
    return {
      statusCode: 401,
      headers: buildHtmlHeaders(),
      body: renderGatePage("Incorrect access phrase. Try again.")
    };
  }

  return {
    statusCode: 303,
    headers: Object.assign({}, buildHtmlHeaders(), {
      Location: "/ops",
      "Set-Cookie": buildGateCookie()
    }),
    body: ""
  };
}

function serveVault() {
  const supabaseUrl = String(process.env.SUPABASE_PROJECT_URL || "").trim();
  if (!supabaseUrl) {
    return {
      statusCode: 500,
      headers: buildHtmlHeaders(),
      body: renderGatePage("SUPABASE_PROJECT_URL is missing in Netlify environment variables.")
    };
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const bootstrap = "<script>window.__RAVIONITE_CONFIG__ = " + JSON.stringify({
    supabaseUrl: supabaseUrl,
    publicGatewayEndpoint: "/.netlify/functions/site-gateway"
  }) + ";</script>";
  const html = template.replace("<!-- RAVIONITE_VAULT_BOOTSTRAP -->", bootstrap);

  return {
    statusCode: 200,
    headers: buildHtmlHeaders(),
    body: html
  };
}

function getAccessPhrase() {
  return String(process.env.OPS_VAULT_PASSPHRASE || "").trim();
}

function hasValidGateCookie(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAME] === getGateToken();
}

function buildGateCookie() {
  return COOKIE_NAME + "=" + getGateToken() + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + String(60 * 60 * 12);
}

function getGateToken() {
  const explicit = String(process.env.OPS_VAULT_SESSION_TOKEN || "").trim();
  if (explicit) return explicit;
  return crypto.createHash("sha256").update(getAccessPhrase()).digest("hex");
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map(function (part) { return part.trim(); })
    .filter(Boolean)
    .reduce(function (acc, part) {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      acc[part.slice(0, index)] = part.slice(index + 1);
      return acc;
    }, {});
}

function buildHtmlHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
  };
}

function renderGatePage(errorMessage) {
  const error = errorMessage ? '<div class="contact-status is-warning" style="max-width:none;margin-top:18px;">' + escapeHtml(errorMessage) + "</div>" : "";
  return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Ravionite Vault Gate</title><meta name=\"robots\" content=\"noindex, nofollow\"><link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link href=\"https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&amp;family=DM+Mono:wght@300;400;500&amp;family=Figtree:wght@300;400;500;600&amp;display=swap\" rel=\"stylesheet\"><link rel=\"stylesheet\" href=\"/theme.css?v=20260406-secure\"></head><body class=\"admin-page\"><div class=\"bg-canvas\"><div class=\"glow g1\"></div><div class=\"glow g2\"></div><div class=\"glow g3\"></div><div class=\"glow g4\"></div><div class=\"glow g5\"></div></div><main class=\"page\"><section class=\"hero hero-admin\" style=\"min-height:100vh;padding-bottom:120px;\"><div class=\"hero-content\"><div class=\"hero-badge\" style=\"opacity:1;transform:none;\"><div class=\"badge-dot\"></div>Restricted Surface</div><h1 class=\"hero-title\"><span class=\"hero-line\" style=\"overflow:visible;\"><span class=\"hero-line-inner\" style=\"transform:none;\">Operations Vault</span></span><span class=\"hero-line\" style=\"overflow:visible;\"><span class=\"hero-line-inner\" style=\"transform:none;\"><span class=\"gradient-text\">Gate.</span></span></span></h1><p class=\"hero-sub\" style=\"opacity:1;transform:none;\">This adds a Netlify-side passphrase wall before the Supabase admin login. The vault is no longer exposed as a public static HTML door in the repo.</p><div class=\"admin-panel\" style=\"margin-top:32px;max-width:620px;\"><div class=\"card-kicker\">Access Phrase</div><h2 class=\"admin-panel-title\">Open the protected admin surface.</h2><form method=\"POST\" action=\"/ops\" class=\"admin-auth-form\"><label class=\"field-wrap\"><span class=\"field-label\">Vault passphrase</span><input class=\"contact-input\" type=\"password\" name=\"access_phrase\" placeholder=\"Enter the Netlify gate phrase\" autocomplete=\"current-password\" required></label><div class=\"admin-toolbar-actions\"><button class=\"btn btn-primary\" type=\"submit\">Open Vault</button><a class=\"btn btn-outline\" href=\"/\">Back To Website</a></div>" + error + "</form></div></div></section></main></body></html>";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function respond(statusCode, body, headers) {
  return { statusCode: statusCode, headers: headers, body: body };
}
