import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.RavioniteSupabase || null;
const tableName = config && config.table ? config.table : "contact_messages";
const adminTableName = "admin_users";
const supabase = hasConfig() ? createClient(config.url, config.anonKey) : null;

let allMessages = [];
let currentUser = null;
let currentAdminRow = null;

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
    "admin-register-form",
    "admin-register-status",
    "admin-login-form",
    "admin-login-status",
    "admin-blocked-email",
    "admin-blocked-user-id",
    "admin-blocked-display-name",
    "admin-blocked-phone",
    "admin-approval-sql",
    "admin-copy-sql",
    "admin-recheck",
    "admin-signout-blocked",
    "admin-blocked-status",
    "admin-blocked-profile-form",
    "admin-blocked-profile-status",
    "admin-user-title",
    "admin-user-meta",
    "admin-refresh",
    "admin-signout",
    "admin-dashboard-profile-form",
    "admin-dashboard-profile-status",
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
  if (els["admin-register-form"]) {
    els["admin-register-form"].addEventListener("submit", handleRegister);
  }
  if (els["admin-login-form"]) {
    els["admin-login-form"].addEventListener("submit", handleLogin);
  }
  if (els["admin-blocked-profile-form"]) {
    els["admin-blocked-profile-form"].addEventListener("submit", handleProfileSave);
  }
  if (els["admin-dashboard-profile-form"]) {
    els["admin-dashboard-profile-form"].addEventListener("submit", handleProfileSave);
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
  currentUser = null;
  currentAdminRow = null;

  if (!session) {
    showState("login");
    setLoginStatus("Only approved admin users can see the inbox.", "");
    setRegisterStatus("Create the admin user first, then sign in on the right.", "");
    allMessages = [];
    renderMessages([]);
    updateMetrics([]);
    return;
  }

  const userResult = await supabase.auth.getUser();
  const user = userResult.data ? userResult.data.user : null;
  if (!user) {
    showState("login");
    setLoginStatus("Your session could not be verified. Please sign in again.", "warning");
    return;
  }

  currentUser = user;

  const adminResult = await supabase
    .from(adminTableName)
    .select("user_id, email, display_name, phone")
    .eq("user_id", user.id)
    .limit(1);

  if (adminResult.error) {
    showState("login");
    setLoginStatus(adminResult.error.message, "warning");
    return;
  }

  currentAdminRow = adminResult.data && adminResult.data.length ? adminResult.data[0] : null;

  if (!currentAdminRow) {
    showBlockedState(user);
    return;
  }

  showDashboardState(user, currentAdminRow);
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

function setRegisterStatus(text, tone) {
  setStatusNode(els["admin-register-status"], text, tone);
}

function setLoginStatus(text, tone) {
  setStatusNode(els["admin-login-status"], text, tone);
}

function setBlockedStatus(text, tone) {
  setStatusNode(els["admin-blocked-status"], text, tone);
}

function setBlockedProfileStatus(text, tone) {
  setStatusNode(els["admin-blocked-profile-status"], text, tone);
}

function setDashboardStatus(text, tone) {
  setStatusNode(els["admin-dashboard-status"], text, tone);
}

function setDashboardProfileStatus(text, tone) {
  setStatusNode(els["admin-dashboard-profile-status"], text, tone);
}

function setStatusNode(node, text, tone) {
  if (!node) return;
  node.textContent = text;
  node.className = tone ? "contact-status is-" + tone : "contact-status";
}

function showBlockedState(user) {
  const profile = getProfileSnapshot(user, null);

  showState("blocked");
  if (els["admin-blocked-email"]) {
    els["admin-blocked-email"].textContent = user.email || "Unknown email";
  }
  if (els["admin-blocked-user-id"]) {
    els["admin-blocked-user-id"].textContent = user.id;
  }
  if (els["admin-blocked-display-name"]) {
    els["admin-blocked-display-name"].textContent = profile.displayName || "Not set";
  }
  if (els["admin-blocked-phone"]) {
    els["admin-blocked-phone"].textContent = profile.phone || "Not set";
  }
  if (els["admin-approval-sql"]) {
    els["admin-approval-sql"].textContent = buildApprovalSql(user);
  }

  syncProfileForms(profile);
  setBlockedStatus("This user still needs an admin row before messages can be read.", "warning");
  setBlockedProfileStatus(
    profile.displayName && profile.phone
      ? "Profile ready. Run the refreshed SQL below, then check access again."
      : "Save your name and phone first if you want them attached to this admin identity.",
    profile.displayName && profile.phone ? "success" : "warning"
  );
}

function showDashboardState(user, adminRow) {
  const profile = getProfileSnapshot(user, adminRow);

  showState("dashboard");
  if (els["admin-user-title"]) {
    els["admin-user-title"].textContent = profile.displayName || user.email || "Authenticated admin";
  }
  if (els["admin-user-meta"]) {
    const metaLine = [user.email || "", profile.phone || ""].filter(Boolean).join(" · ");
    els["admin-user-meta"].textContent = metaLine || "Authenticated admin session";
  }

  syncProfileForms(profile);
  setDashboardStatus("Inbox ready.", "");
  setDashboardProfileStatus(
    profile.displayName && profile.phone ? "Profile ready." : "Add your name and phone to complete the admin identity.",
    profile.displayName && profile.phone ? "success" : "warning"
  );
}

function syncProfileForms(profile) {
  ["admin-blocked-profile-form", "admin-dashboard-profile-form"].forEach(function (id) {
    const form = els[id];
    if (!form) return;
    const nameInput = form.querySelector('input[name="display_name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    if (nameInput) nameInput.value = profile.displayName || "";
    if (phoneInput) phoneInput.value = profile.phone || "";
  });
}

function getProfileSnapshot(user, adminRow) {
  const metadata = user && user.user_metadata ? user.user_metadata : {};
  return {
    displayName: firstNonEmpty(
      adminRow && adminRow.display_name,
      metadata.display_name,
      metadata.full_name,
      metadata.name
    ),
    phone: firstNonEmpty(
      user && user.phone,
      adminRow && adminRow.phone,
      metadata.phone_number,
      metadata.contact_phone,
      metadata.phone
    )
  };
}

function firstNonEmpty() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildApprovalSql(user) {
  const profile = getProfileSnapshot(user, currentAdminRow);
  const safeId = escapeSql(user.id || "");
  const safeEmail = escapeSql(user.email || "");
  return "insert into public.admin_users (user_id, email, display_name, phone) values ('" + safeId + "', '" + safeEmail + "', " + sqlNullable(profile.displayName) + ", " + sqlNullable(profile.phone) + ") on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name, phone = excluded.phone;";
}

function sqlNullable(value) {
  return value ? "'" + escapeSql(value) + "'" : "null";
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const displayName = normalizeName(formData.get("display_name"));
  const phone = normalizePhone(formData.get("phone"));
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const validationError = validateProfileInput(displayName, phone) || validateEmailPassword(email, password);
  if (validationError) {
    setRegisterStatus(validationError, "warning");
    return;
  }

  setButtonState(submit, true, "Creating...");
  setRegisterStatus("Creating your admin account...", "");

  const result = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo: getRedirectUrl(),
      data: buildProfileMetadata(displayName, phone)
    }
  });

  setButtonState(submit, false, "Create Account");

  if (result.error) {
    setRegisterStatus(result.error.message, "warning");
    return;
  }

  form.reset();

  if (result.data && result.data.session) {
    setRegisterStatus("Account created. Finish approval below, then you can open the inbox.", "success");
    await syncSession(result.data.session);
    return;
  }

  setRegisterStatus("If this is a new email, check your inbox to confirm it. If the user already exists, sign in on the right.", "success");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const validationError = validateEmailPassword(email, password, false);
  if (validationError) {
    setLoginStatus(validationError, "warning");
    return;
  }

  setButtonState(submit, true, "Signing In...");
  setLoginStatus("Checking your admin session...", "");

  const result = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  setButtonState(submit, false, "Sign In");

  if (result.error) {
    setLoginStatus(result.error.message, "warning");
    return;
  }

  form.reset();
  await syncSession(result.data ? result.data.session : null);
}

async function handleProfileSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const displayName = normalizeName(formData.get("display_name"));
  const phone = normalizePhone(formData.get("phone"));
  const isBlockedForm = form.id === "admin-blocked-profile-form";
  const setProfileStatus = isBlockedForm ? setBlockedProfileStatus : setDashboardProfileStatus;

  const validationError = validateProfileInput(displayName, phone);
  if (validationError) {
    setProfileStatus(validationError, "warning");
    return;
  }

  if (!currentUser) {
    setProfileStatus("Sign in first, then save your profile.", "warning");
    return;
  }

  setButtonState(submit, true, "Saving...");
  setProfileStatus("Saving your profile...", "");

  const result = await supabase.auth.updateUser({
    data: buildProfileMetadata(displayName, phone, currentUser.user_metadata || {})
  });

  setButtonState(submit, false, "Save Profile");

  if (result.error) {
    setProfileStatus(result.error.message, "warning");
    return;
  }

  const sessionResult = await supabase.auth.getSession();
  await syncSession(sessionResult.data ? sessionResult.data.session : null);
  setProfileStatus("Profile saved.", "success");

  if (isBlockedForm) {
    setBlockedStatus("Profile saved. The SQL below now includes the latest name and phone details.", "success");
  }
}

function buildProfileMetadata(displayName, phone, existing) {
  const next = Object.assign({}, existing || {});
  next.display_name = displayName;
  next.full_name = displayName;
  next.name = displayName;
  next.phone_number = phone;
  next.contact_phone = phone;
  return next;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validateProfileInput(displayName, phone) {
  if (displayName.length < 2) {
    return "Enter a valid name with at least 2 characters.";
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Enter a valid phone number.";
  }

  return "";
}

function validateEmailPassword(email, password, requireStrongPassword) {
  if (!email || !password) {
    return "Enter both your email and password.";
  }

  if (requireStrongPassword !== false && password.length < 8) {
    return "Use a password with at least 8 characters.";
  }

  return "";
}

function getRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

function setButtonState(button, disabled, text) {
  if (!button) return;
  button.disabled = disabled;
  button.textContent = text;
}

async function signOut() {
  await supabase.auth.signOut({ scope: "local" });
  currentUser = null;
  currentAdminRow = null;
  allMessages = [];
  renderMessages([]);
  updateMetrics([]);
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
