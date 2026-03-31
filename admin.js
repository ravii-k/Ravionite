import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.RavioniteSupabase || null;
const tableName = config && config.table ? config.table : "contact_messages";
const adminTableName = "admin_users";
const supabase = hasConfig() ? createClient(config.url, config.anonKey) : null;
let allMessages = [];

const els = {};

document.addEventListener("DOMContentLoaded", function () {
  cacheElements();
  bootTheme();
  bindEvents();

  if (!hasConfig()) {
    setLoginStatus("Supabase config is missing. Check supabase-config.js before using this page.", "warning");
    return;
  }

  primeSession();
  supabase.auth.onAuthStateChange(function (_event, session) {
    setTimeout(function () {
      syncSession(session);
    }, 0);
  });
});

function cacheElements() {
  [
    "admin-login-state",
    "admin-blocked-state",
    "admin-dashboard",
    "admin-login-form",
    "admin-login-status",
    "admin-blocked-email",
    "admin-blocked-user-id",
    "admin-approval-sql",
    "admin-copy-sql",
    "admin-recheck",
    "admin-signout-blocked",
    "admin-blocked-status",
    "admin-user-email",
    "admin-refresh",
    "admin-signout",
    "admin-search",
    "admin-results-meta",
    "admin-dashboard-status",
    "admin-message-list",
    "admin-empty",
    "admin-total-count",
    "admin-sender-count",
    "admin-latest-date"
  ].forEach(function (id) {
    els[id] = document.getElementById(id);
  });
}

function bootTheme() {
  if (!window.NexusTheme) return;
  window.NexusTheme.setupNav("navbar");
  window.NexusTheme.setupScrollProgress("scrollProgress");
  window.NexusTheme.setupHeroIntro();
  window.NexusTheme.setupReveal();
  window.NexusTheme.createHeroScene({
    canvasId: "admin-hero-canvas",
    heroSelector: "#admin-hero",
    widthRatio: 0.68,
    variant: "research"
  });
}

function bindEvents() {
  if (els["admin-login-form"]) {
    els["admin-login-form"].addEventListener("submit", handleLogin);
  }
  if (els["admin-refresh"]) {
    els["admin-refresh"].addEventListener("click", refreshMessages);
  }
  if (els["admin-signout"]) {
    els["admin-signout"].addEventListener("click", signOut);
  }
  if (els["admin-signout-blocked"]) {
    els["admin-signout-blocked"].addEventListener("click", signOut);
  }
  if (els["admin-recheck"]) {
    els["admin-recheck"].addEventListener("click", recheckAccess);
  }
  if (els["admin-copy-sql"]) {
    els["admin-copy-sql"].addEventListener("click", copyApprovalSql);
  }
  if (els["admin-search"]) {
    els["admin-search"].addEventListener("input", filterMessages);
  }
}

function hasConfig() {
  return !!(
    config &&
    typeof config.url === "string" &&
    /^https:\/\//.test(config.url) &&
    typeof config.anonKey === "string" &&
    config.anonKey
  );
}

async function primeSession() {
  const result = await supabase.auth.getSession();
  await syncSession(result.data ? result.data.session : null);
}

async function syncSession(session) {
  if (!session) {
    showState("login");
    setLoginStatus("Only approved admin users can see the inbox.", "");
    return;
  }

  const userResult = await supabase.auth.getUser();
  const user = userResult.data ? userResult.data.user : null;
  if (!user) {
    showState("login");
    setLoginStatus("Your session could not be verified. Please sign in again.", "warning");
    return;
  }

  const adminResult = await supabase
    .from(adminTableName)
    .select("user_id, email")
    .eq("user_id", user.id)
    .limit(1);

  if (adminResult.error) {
    showState("login");
    setLoginStatus(adminResult.error.message, "warning");
    return;
  }

  if (!adminResult.data || !adminResult.data.length) {
    showBlockedState(user);
    return;
  }

  showDashboardState(user);
  await loadMessages();
}

function showState(state) {
  toggleHidden(els["admin-login-state"], state !== "login");
  toggleHidden(els["admin-blocked-state"], state !== "blocked");
  toggleHidden(els["admin-dashboard"], state !== "dashboard");
}

function toggleHidden(node, hidden) {
  if (!node) return;
  node.hidden = hidden;
}

function setLoginStatus(text, tone) {
  setStatusNode(els["admin-login-status"], text, tone);
}

function setBlockedStatus(text, tone) {
  setStatusNode(els["admin-blocked-status"], text, tone);
}

function setDashboardStatus(text, tone) {
  setStatusNode(els["admin-dashboard-status"], text, tone);
}

function setStatusNode(node, text, tone) {
  if (!node) return;
  node.textContent = text;
  node.className = tone ? "contact-status is-" + tone : "contact-status";
}

function showBlockedState(user) {
  showState("blocked");
  if (els["admin-blocked-email"]) {
    els["admin-blocked-email"].textContent = user.email || "Unknown email";
  }
  if (els["admin-blocked-user-id"]) {
    els["admin-blocked-user-id"].textContent = user.id;
  }
  if (els["admin-approval-sql"]) {
    els["admin-approval-sql"].textContent = buildApprovalSql(user);
  }
  setBlockedStatus("This user still needs an admin row before messages can be read.", "warning");
}

function showDashboardState(user) {
  showState("dashboard");
  if (els["admin-user-email"]) {
    els["admin-user-email"].textContent = user.email || "Authenticated admin";
  }
  setDashboardStatus("Inbox ready.", "");
}

function buildApprovalSql(user) {
  const safeId = escapeSql(user.id || "");
  const safeEmail = escapeSql(user.email || "");
  return "insert into public.admin_users (user_id, email) values ('" + safeId + "', '" + safeEmail + "') on conflict (user_id) do update set email = excluded.email;";
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setLoginStatus("Enter both your email and password.", "warning");
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = "Signing In...";
  }
  setLoginStatus("Checking your admin session...", "");

  const result = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (submit) {
    submit.disabled = false;
    submit.textContent = "Sign In";
  }

  if (result.error) {
    setLoginStatus(result.error.message, "warning");
    return;
  }

  form.reset();
  await syncSession(result.data ? result.data.session : null);
}

async function signOut() {
  await supabase.auth.signOut({ scope: "local" });
  allMessages = [];
  renderMessages([]);
  showState("login");
  setLoginStatus("Signed out.", "success");
}

async function recheckAccess() {
  setBlockedStatus("Checking access again...", "");
  const result = await supabase.auth.getSession();
  await syncSession(result.data ? result.data.session : null);
}

async function refreshMessages() {
  await loadMessages();
}

async function loadMessages() {
  setDashboardStatus("Refreshing inbox...", "");

  const result = await supabase
    .from(tableName)
    .select("id, name, email, message, word_count, source, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200);

  if (result.error) {
    allMessages = [];
    renderMessages([]);
    updateMetrics([]);
    setDashboardStatus(result.error.message, "warning");
    return;
  }

  allMessages = result.data || [];
  filterMessages();
  updateMetrics(allMessages, result.count || allMessages.length);
  setDashboardStatus(allMessages.length ? "Inbox synced." : "No messages yet.", allMessages.length ? "success" : "");
}

function filterMessages() {
  const query = els["admin-search"] ? els["admin-search"].value.trim().toLowerCase() : "";
  const filtered = !query
    ? allMessages.slice()
    : allMessages.filter(function (message) {
        return [message.name, message.email, message.message, message.source]
          .join(" ")
          .toLowerCase()
          .indexOf(query) !== -1;
      });

  renderMessages(filtered);
  if (els["admin-results-meta"]) {
    els["admin-results-meta"].textContent = filtered.length + " result" + (filtered.length === 1 ? "" : "s");
  }
}

function renderMessages(messages) {
  if (!els["admin-message-list"] || !els["admin-empty"]) return;

  if (!messages.length) {
    els["admin-message-list"].innerHTML = "";
    els["admin-empty"].hidden = false;
    return;
  }

  els["admin-empty"].hidden = true;
  els["admin-message-list"].innerHTML = messages.map(renderMessageCard).join("");
}

function renderMessageCard(message) {
  const messageText = escapeHtml(message.message || "").replace(/\n/g, "<br>");
  const name = escapeHtml(message.name || "Unknown sender");
  const email = escapeHtml(message.email || "No email");
  const source = escapeHtml(message.source || "ravionite-website");
  const createdAt = formatDate(message.created_at);
  const words = String(message.word_count || 0);

  return '<article class="admin-message-card">' +
    '<div class="admin-message-head">' +
      '<div>' +
        '<div class="quote-date">' + createdAt + '</div>' +
        '<div class="admin-message-name">' + name + '</div>' +
      '</div>' +
      '<a class="admin-email" href="mailto:' + email + '">' + email + '</a>' +
    '</div>' +
    '<div class="admin-message-copy">' + messageText + '</div>' +
    '<div class="admin-chip-row">' +
      '<span class="tag-pill">' + words + ' words</span>' +
      '<span class="tag-pill">' + source + '</span>' +
    '</div>' +
  '</article>';
}

function updateMetrics(messages, totalCount) {
  const total = typeof totalCount === "number" ? totalCount : messages.length;
  const uniqueSenders = new Set(messages.map(function (item) {
    return (item.email || "").toLowerCase();
  }).filter(Boolean)).size;
  const latest = messages.length ? formatShortDate(messages[0].created_at) : "--";

  if (els["admin-total-count"]) els["admin-total-count"].textContent = padMetric(total);
  if (els["admin-sender-count"]) els["admin-sender-count"].textContent = padMetric(uniqueSenders);
  if (els["admin-latest-date"]) els["admin-latest-date"].textContent = latest;
}

function padMetric(value) {
  if (value > 99) return String(value);
  return String(value).padStart(2, "0");
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function copyApprovalSql() {
  if (!els["admin-approval-sql"] || !window.NexusTheme || !window.NexusTheme.copyText) return;
  try {
    await window.NexusTheme.copyText(els["admin-approval-sql"].textContent || "");
    setBlockedStatus("SQL copied. Run it in Supabase, then come back here.", "success");
  } catch (_error) {
    setBlockedStatus("Could not copy automatically. Select the SQL and copy it manually.", "warning");
  }
}

