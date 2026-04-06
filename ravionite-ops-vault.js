import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const storageKey = "ravionite.admin.publishable_key";
const projectUrl = (window.__RAVIONITE_CONFIG__ && window.__RAVIONITE_CONFIG__.supabaseUrl) || document.documentElement.dataset.supabaseUrl || "";
const adminTableName = "admin_users";
const messageTableName = "contact_messages";
const requestTableName = "admin_requests";
const thoughtTableName = "thoughts";
const publicFunctionName = "public-site-gateway";
const adminRequestFunction = "admin-request-queue";

let supabase = null;
let authSubscription = null;
let allMessages = [];
let pendingRequests = [];
let allThoughts = [];
let messageTotalCount = 0;
let currentUser = null;
let currentAdminRow = null;

const els = {};

document.addEventListener("DOMContentLoaded", function () {
  cacheElements();
  bootTheme();
  bindEvents();
  hydratePublishableKey();
  bootClientFromStorage();
});

function cacheElements() {
  [
    "nav-requests-link",
    "nav-messages-link",
    "admin-auth-state",
    "admin-request-form",
    "admin-request-status",
    "admin-login-form",
    "admin-login-status",
    "admin-publishable-key",
    "admin-clear-key",
    "admin-blocked-state",
    "admin-blocked-email",
    "admin-blocked-user-id",
    "admin-signout-blocked",
    "admin-blocked-status",
    "admin-dashboard",
    "admin-request-list",
    "admin-request-empty",
    "admin-queue-status",
    "admin-user-title",
    "admin-user-meta",
    "admin-refresh",
    "admin-signout",
    "admin-dashboard-profile-form",
    "admin-dashboard-profile-status",
    "admin-thought-form",
    "admin-thought-status",
    "admin-thought-list",
    "admin-thought-empty",
    "admin-search",
    "admin-results-meta",
    "admin-dashboard-status",
    "admin-message-list",
    "admin-message-empty",
    "admin-total-count",
    "admin-pending-count",
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
    widthRatio: 0.56,
    sceneScale: 0.66,
    sceneX: 0.06,
    variant: "research"
  });
}

function bindEvents() {
  if (els["admin-request-form"]) {
    els["admin-request-form"].addEventListener("submit", handleRequestSubmit);
  }
  if (els["admin-login-form"]) {
    els["admin-login-form"].addEventListener("submit", handleLogin);
  }
  if (els["admin-clear-key"]) {
    els["admin-clear-key"].addEventListener("click", forgetPublishableKey);
  }
  if (els["admin-dashboard-profile-form"]) {
    els["admin-dashboard-profile-form"].addEventListener("submit", handleProfileSave);
  }
  if (els["admin-thought-form"]) {
    els["admin-thought-form"].addEventListener("submit", handleThoughtSubmit);
  }
  if (els["admin-refresh"]) {
    els["admin-refresh"].addEventListener("click", refreshDashboard);
  }
  if (els["admin-signout"]) {
    els["admin-signout"].addEventListener("click", signOut);
  }
  if (els["admin-signout-blocked"]) {
    els["admin-signout-blocked"].addEventListener("click", signOut);
  }
  if (els["admin-search"]) {
    els["admin-search"].addEventListener("input", filterMessages);
  }
  if (els["admin-request-list"]) {
    els["admin-request-list"].addEventListener("click", handleRequestAction);
  }
  if (els["admin-thought-list"]) {
    els["admin-thought-list"].addEventListener("click", handleThoughtAction);
  }
}

function hydratePublishableKey() {
  const savedKey = localStorage.getItem(storageKey) || "";
  if (els["admin-publishable-key"] && savedKey) {
    els["admin-publishable-key"].value = savedKey;
  }
}

function bootClientFromStorage() {
  const publishableKey = localStorage.getItem(storageKey) || "";
  if (!projectUrl || !publishableKey) {
    showState("loggedOut");
    setRequestStatus("This sends a request. It does not create a login immediately.", "");
    setLoginStatus("Paste your publishable key to sign in. It stays in this browser only.", "warning");
    return;
  }

  ensureSupabase(publishableKey);
  primeSession();
}

function ensureSupabase(publishableKey) {
  if (!projectUrl || !publishableKey) return null;
  if (supabase && (els["admin-publishable-key"] ? els["admin-publishable-key"].value === publishableKey : true)) {
    return supabase;
  }

  supabase = createClient(projectUrl, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });

  if (authSubscription) {
    authSubscription.subscription.unsubscribe();
  }

  authSubscription = supabase.auth.onAuthStateChange(function (_event, session) {
    setTimeout(function () {
      syncSession(session);
    }, 0);
  });

  return supabase;
}

async function primeSession() {
  if (!supabase) return;
  const result = await supabase.auth.getSession();
  await syncSession(result.data ? result.data.session : null);
}

async function syncSession(session) {
  currentUser = null;
  currentAdminRow = null;

  if (!supabase || !session) {
    pendingRequests = [];
    allMessages = [];
    allThoughts = [];
    messageTotalCount = 0;
    if (els["admin-search"]) els["admin-search"].value = "";
    renderPendingRequests([]);
    renderMessages([]);
    renderThoughts([]);
    updateMetrics();
    showState("loggedOut");
    setRequestStatus("This sends a request. It does not create a login immediately.", "");
    setLoginStatus(localStorage.getItem(storageKey) ? "Only approved admins can open the request queue and inbox." : "Paste your publishable key to sign in. It stays in this browser only.", localStorage.getItem(storageKey) ? "" : "warning");
    return;
  }

  const userResult = await supabase.auth.getUser();
  const user = userResult.data ? userResult.data.user : null;
  if (!user) {
    showState("loggedOut");
    setLoginStatus("Your session could not be verified. Please sign in again.", "warning");
    return;
  }

  currentUser = user;

  const adminResult = await supabase
    .from(adminTableName)
    .select("user_id, email, display_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminResult.error) {
    showState("loggedOut");
    setLoginStatus(adminResult.error.message, "warning");
    return;
  }

  if (!adminResult.data) {
    showBlockedState(user);
    return;
  }

  currentAdminRow = adminResult.data;
  showDashboardState(user, currentAdminRow);
  await refreshDashboard();
}

function showState(state) {
  const dashboardVisible = state === "dashboard";
  toggleHidden(els["admin-auth-state"], state !== "loggedOut");
  toggleHidden(els["admin-blocked-state"], state !== "blocked");
  toggleHidden(els["admin-dashboard"], !dashboardVisible);
  toggleHidden(els["nav-requests-link"], !dashboardVisible);
  toggleHidden(els["nav-messages-link"], !dashboardVisible);
}

function toggleHidden(node, hidden) {
  if (!node) return;
  node.hidden = hidden;
}

function setRequestStatus(text, tone) {
  setStatusNode(els["admin-request-status"], text, tone);
}

function setLoginStatus(text, tone) {
  setStatusNode(els["admin-login-status"], text, tone);
}

function setBlockedStatus(text, tone) {
  setStatusNode(els["admin-blocked-status"], text, tone);
}

function setQueueStatus(text, tone) {
  setStatusNode(els["admin-queue-status"], text, tone);
}

function setDashboardStatus(text, tone) {
  setStatusNode(els["admin-dashboard-status"], text, tone);
}

function setDashboardProfileStatus(text, tone) {
  setStatusNode(els["admin-dashboard-profile-status"], text, tone);
}

function setThoughtStatus(text, tone) {
  setStatusNode(els["admin-thought-status"], text, tone);
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
  setBlockedStatus("This Auth account is not approved for Ravionite admin access.", "warning");
}

function showDashboardState(user, adminRow) {
  const profile = getProfileSnapshot(user, adminRow);

  showState("dashboard");
  if (els["admin-user-title"]) {
    els["admin-user-title"].textContent = profile.displayName || user.email || "Approved admin";
  }
  if (els["admin-user-meta"]) {
    const metaLine = [user.email || "", profile.phone || ""].filter(Boolean).join(" · ");
    els["admin-user-meta"].textContent = metaLine || "Approved admin session";
  }
  syncProfileForm(profile);
  setDashboardProfileStatus(profile.displayName && profile.phone ? "Profile ready." : "Add your name and phone to complete the admin identity.", profile.displayName && profile.phone ? "success" : "warning");
  setThoughtStatus("Thought studio ready.", "");
  setQueueStatus("Request queue ready.", "");
  setDashboardStatus("Inbox ready.", "");
}

function syncProfileForm(profile) {
  const form = els["admin-dashboard-profile-form"];
  if (!form) return;
  const nameInput = form.querySelector('input[name="display_name"]');
  const phoneInput = form.querySelector('input[name="phone"]');
  if (nameInput) nameInput.value = profile.displayName || "";
  if (phoneInput) phoneInput.value = profile.phone || "";
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
      adminRow && adminRow.phone,
      user && user.phone,
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

async function handleRequestSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const displayName = normalizeName(formData.get("display_name"));
  const phone = normalizePhone(formData.get("phone"));
  const email = normalizeEmail(formData.get("email"));
  const honeypot = String(formData.get("website") || "").trim();

  const validationError = validateRequestInput(displayName, phone, email);
  if (validationError) {
    setRequestStatus(validationError, "warning");
    return;
  }

  setButtonState(submit, true, "Sending...");
  setRequestStatus("Sending request...", "");

  try {
    await callPublicGateway({
      action: "admin_request",
      display_name: displayName,
      phone: phone,
      email: email,
      website: honeypot
    });
    form.reset();
    setRequestStatus("Request sent.", "success");
  } catch (error) {
    setRequestStatus(error instanceof Error ? error.message : "Could not send the request.", "warning");
  } finally {
    setButtonState(submit, false, "Send Request");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const publishableKey = String(formData.get("publishable_key") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  const validationError = validateEmailPassword(email, password, false) || validatePublishableKey(publishableKey);
  if (validationError) {
    setLoginStatus(validationError, "warning");
    return;
  }

  localStorage.setItem(storageKey, publishableKey);
  ensureSupabase(publishableKey);

  setButtonState(submit, true, "Signing In...");
  setLoginStatus("Checking your admin session...", "");

  const result = await supabase.auth.signInWithPassword({ email, password });

  setButtonState(submit, false, "Sign In");

  if (result.error) {
    setLoginStatus(result.error.message, "warning");
    return;
  }

  form.querySelector('input[name="password"]').value = "";
  await syncSession(result.data ? result.data.session : null);
}

function validatePublishableKey(value) {
  if (!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(value)) {
    return "Enter your Supabase publishable key to sign in.";
  }
  return "";
}

function forgetPublishableKey() {
  localStorage.removeItem(storageKey);
  if (els["admin-publishable-key"]) {
    els["admin-publishable-key"].value = "";
  }
  supabase = null;
  currentUser = null;
  currentAdminRow = null;
  pendingRequests = [];
  allMessages = [];
  allThoughts = [];
  messageTotalCount = 0;
  renderPendingRequests([]);
  renderMessages([]);
  renderThoughts([]);
  updateMetrics();
  showState("loggedOut");
  setLoginStatus("Publishable key cleared from this browser.", "success");
}

async function handleProfileSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const displayName = normalizeName(formData.get("display_name"));
  const phone = normalizePhone(formData.get("phone"));

  const validationError = validateProfileInput(displayName, phone);
  if (validationError) {
    setDashboardProfileStatus(validationError, "warning");
    return;
  }

  if (!currentUser || !currentAdminRow || !supabase) {
    setDashboardProfileStatus("Sign in with an approved admin account first.", "warning");
    return;
  }

  setButtonState(submit, true, "Saving...");
  setDashboardProfileStatus("Saving your profile...", "");

  const metadataResult = await supabase.auth.updateUser({
    data: buildProfileMetadata(displayName, phone, currentUser.user_metadata || {})
  });

  if (metadataResult.error) {
    setButtonState(submit, false, "Save Profile");
    setDashboardProfileStatus(metadataResult.error.message, "warning");
    return;
  }

  const rowResult = await supabase
    .from(adminTableName)
    .update({ display_name: displayName, phone: phone })
    .eq("user_id", currentUser.id);

  setButtonState(submit, false, "Save Profile");

  if (rowResult.error) {
    setDashboardProfileStatus(rowResult.error.message, "warning");
    return;
  }

  currentAdminRow = Object.assign({}, currentAdminRow, { display_name: displayName, phone });
  showDashboardState(currentUser, currentAdminRow);
  setDashboardProfileStatus("Profile saved.", "success");
}

async function handleThoughtSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const body = normalizeThought(formData.get("thought_body"));
  const isPublished = formData.get("is_published") === "on";
  const validationError = validateThought(body);

  if (validationError) {
    setThoughtStatus(validationError, "warning");
    return;
  }

  if (!currentUser || !supabase) {
    setThoughtStatus("Sign in with an approved admin account first.", "warning");
    return;
  }

  setButtonState(submit, true, "Saving...");
  setThoughtStatus("Saving thought...", "");

  const result = await supabase
    .from(thoughtTableName)
    .insert({
      body: body,
      is_published: isPublished,
      created_by: currentUser.id,
      updated_by: currentUser.id
    });

  setButtonState(submit, false, "Add Thought");

  if (result.error) {
    setThoughtStatus(result.error.message, "warning");
    return;
  }

  form.reset();
  const checkbox = form.querySelector('input[name="is_published"]');
  if (checkbox) checkbox.checked = true;
  setThoughtStatus(isPublished ? "Thought published." : "Thought saved as draft.", "success");
  await loadThoughts();
}

async function loadThoughts() {
  setThoughtStatus("Refreshing thoughts...", "");

  const result = await supabase
    .from(thoughtTableName)
    .select("id, body, is_published, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (result.error) {
    allThoughts = [];
    renderThoughts([]);
    setThoughtStatus(result.error.message, "warning");
    return;
  }

  allThoughts = result.data || [];
  renderThoughts(allThoughts);
  setThoughtStatus(allThoughts.length ? "Thought archive synced." : "No thoughts yet.", allThoughts.length ? "success" : "");
}

function renderThoughts(thoughts) {
  if (!els["admin-thought-list"] || !els["admin-thought-empty"]) return;
  if (!thoughts.length) {
    els["admin-thought-list"].innerHTML = "";
    els["admin-thought-empty"].hidden = false;
    return;
  }

  els["admin-thought-empty"].hidden = true;
  els["admin-thought-list"].innerHTML = thoughts.map(renderThoughtCard).join("");
}

function renderThoughtCard(thought) {
  const thoughtId = escapeHtml(thought.id || "");
  const body = escapeHtml(thought.body || "");
  const createdAt = formatDate(thought.created_at);
  const statusLabel = thought.is_published ? "Published" : "Draft";

  return '<article class="admin-thought-card">' +
    '<div class="admin-message-head">' +
      '<div>' +
        '<div class="quote-date">' + createdAt + '</div>' +
        '<div class="admin-message-name">Thought</div>' +
      '</div>' +
      '<span class="tag-pill">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="admin-message-copy">' + body + '</div>' +
    '<div class="admin-thought-actions">' +
      '<button class="btn btn-outline" type="button" data-thought-action="toggle" data-thought-id="' + thoughtId + '" data-thought-published="' + (thought.is_published ? 'true' : 'false') + '">' + (thought.is_published ? 'Unpublish' : 'Publish') + '</button>' +
      '<button class="btn btn-outline" type="button" data-thought-action="delete" data-thought-id="' + thoughtId + '">Delete</button>' +
    '</div>' +
  '</article>';
}

async function handleThoughtAction(event) {
  const button = event.target.closest("button[data-thought-action]");
  if (!button || !supabase || !currentUser) return;

  const action = button.getAttribute("data-thought-action");
  const thoughtId = button.getAttribute("data-thought-id");
  const published = button.getAttribute("data-thought-published") === "true";
  if (!action || !thoughtId) return;

  setButtonState(button, true, action === "delete" ? "Deleting..." : published ? "Unpublishing..." : "Publishing...");
  setThoughtStatus(action === "delete" ? "Deleting thought..." : published ? "Unpublishing thought..." : "Publishing thought...", "");

  let result;
  if (action === "delete") {
    result = await supabase.from(thoughtTableName).delete().eq("id", thoughtId);
  } else {
    result = await supabase
      .from(thoughtTableName)
      .update({
        is_published: !published,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id
      })
      .eq("id", thoughtId);
  }

  if (result.error) {
    setButtonState(button, false, action === "delete" ? "Delete" : published ? "Unpublish" : "Publish");
    setThoughtStatus(result.error.message, "warning");
    return;
  }

  setThoughtStatus(action === "delete" ? "Thought deleted." : !published ? "Thought published." : "Thought moved to draft.", "success");
  await loadThoughts();
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeThought(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 480);
}

function validateRequestInput(displayName, phone, email) {
  return validateProfileInput(displayName, phone) || validateEmail(email);
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

function validateThought(value) {
  if (value.length < 12) {
    return "Write a thought with at least 12 characters.";
  }
  if (value.length > 480) {
    return "Keep each thought under 480 characters.";
  }
  return "";
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Enter a valid email address.";
  }
  return "";
}

function validateEmailPassword(email, password, requireStrongPassword) {
  if (!email || !password) {
    return "Enter both your email and password.";
  }

  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (requireStrongPassword !== false && password.length < 8) {
    return "Use a password with at least 8 characters.";
  }
  return "";
}

function setButtonState(button, disabled, text) {
  if (!button) return;
  button.disabled = disabled;
  button.textContent = text;
}

async function signOut() {
  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }
  currentUser = null;
  currentAdminRow = null;
  pendingRequests = [];
  allMessages = [];
  allThoughts = [];
  messageTotalCount = 0;
  if (els["admin-search"]) els["admin-search"].value = "";
  renderPendingRequests([]);
  renderMessages([]);
  renderThoughts([]);
  updateMetrics();
  showState("loggedOut");
  window.location.href = "/ops-signout";
}

async function refreshDashboard() {
  if (!currentAdminRow || !supabase) return;
  await Promise.all([loadPendingRequests(), loadMessages(), loadThoughts()]);
}

async function loadPendingRequests() {
  setQueueStatus("Refreshing request queue...", "");

  const result = await supabase
    .from(requestTableName)
    .select("id, requested_name, requested_email, requested_phone, status, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(100);

  if (result.error) {
    pendingRequests = [];
    renderPendingRequests([]);
    updateMetrics();
    setQueueStatus(result.error.message, "warning");
    return;
  }

  pendingRequests = result.data || [];
  renderPendingRequests(pendingRequests);
  updateMetrics();
  setQueueStatus(pendingRequests.length ? "Pending requests loaded." : "No pending requests.", pendingRequests.length ? "success" : "");
}

function renderPendingRequests(requests) {
  if (!els["admin-request-list"] || !els["admin-request-empty"]) return;
  if (!requests.length) {
    els["admin-request-list"].innerHTML = "";
    els["admin-request-empty"].hidden = false;
    return;
  }
  els["admin-request-empty"].hidden = true;
  els["admin-request-list"].innerHTML = requests.map(renderRequestCard).join("");
}

function renderRequestCard(request) {
  const requestedAt = formatDate(request.requested_at);
  const name = escapeHtml(request.requested_name || "Pending request");
  const email = escapeHtml(request.requested_email || "No email");
  const phone = escapeHtml(request.requested_phone || "No phone");
  const requestId = escapeHtml(request.id || "");

  return '<article class="admin-request-card">' +
    '<div class="admin-message-head">' +
      '<div>' +
        '<div class="quote-date">' + requestedAt + '</div>' +
        '<div class="admin-message-name">' + name + '</div>' +
      '</div>' +
      '<a class="admin-email" href="mailto:' + email + '">' + email + '</a>' +
    '</div>' +
    '<div class="admin-chip-row">' +
      '<span class="tag-pill">' + phone + '</span>' +
      '<span class="tag-pill">Pending</span>' +
    '</div>' +
    '<div class="admin-request-actions">' +
      '<button class="btn btn-primary" type="button" data-request-action="approve" data-request-id="' + requestId + '">Approve</button>' +
      '<button class="btn btn-outline" type="button" data-request-action="delete" data-request-id="' + requestId + '">Delete</button>' +
    '</div>' +
  '</article>';
}

async function handleRequestAction(event) {
  const button = event.target.closest("button[data-request-action]");
  if (!button) return;

  const action = button.getAttribute("data-request-action");
  const requestId = button.getAttribute("data-request-id");
  if (!action || !requestId) return;

  setRequestButtonsDisabled(requestId, true);
  setQueueStatus(action === "approve" ? "Approving request..." : "Deleting request...", "");

  try {
    const payload = await invokeAdminRequestAction(action, requestId);
    if (action === "approve") {
      setQueueStatus(payload.mode === "invited" ? "Request approved. Invite email sent." : "Request approved. Existing user promoted to admin.", "success");
    } else {
      setQueueStatus("Request deleted.", "success");
    }
    await loadPendingRequests();
  } catch (error) {
    setQueueStatus(error instanceof Error ? error.message : "Could not process the request.", "warning");
  } finally {
    setRequestButtonsDisabled(requestId, false);
  }
}

function setRequestButtonsDisabled(requestId, disabled) {
  const selector = 'button[data-request-id="' + cssEscape(requestId) + '"]';
  document.querySelectorAll(selector).forEach(function (button) {
    button.disabled = disabled;
  });
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/"/g, '\"');
}

async function invokeAdminRequestAction(action, requestId) {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data ? sessionResult.data.session : null;
  const publishableKey = localStorage.getItem(storageKey) || "";
  if (!session || !session.access_token) {
    throw new Error("Your session expired. Sign in again.");
  }
  const response = await fetch(projectUrl.replace(/\/+$/, "") + "/functions/v1/" + adminRequestFunction, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + session.access_token,
      "apikey": publishableKey
    },
    body: JSON.stringify({ action, requestId })
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("The admin approval function is not deployed in Supabase yet.");
    }
    throw new Error(payload && payload.error ? payload.error : "Could not process this admin request.");
  }
  return payload;
}

async function loadMessages() {
  setDashboardStatus("Refreshing inbox...", "");

  const result = await supabase
    .from(messageTableName)
    .select("id, name, email, message, word_count, source, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200);

  if (result.error) {
    allMessages = [];
    messageTotalCount = 0;
    renderMessages([]);
    updateMetrics();
    setDashboardStatus(result.error.message, "warning");
    return;
  }

  allMessages = result.data || [];
  messageTotalCount = typeof result.count === "number" ? result.count : allMessages.length;
  filterMessages();
  updateMetrics();
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
  if (!els["admin-message-list"] || !els["admin-message-empty"]) return;
  if (!messages.length) {
    els["admin-message-list"].innerHTML = "";
    els["admin-message-empty"].hidden = false;
    return;
  }
  els["admin-message-empty"].hidden = true;
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

function updateMetrics() {
  const latest = allMessages.length ? formatShortDate(allMessages[0].created_at) : "--";
  if (els["admin-total-count"]) els["admin-total-count"].textContent = padMetric(messageTotalCount);
  if (els["admin-pending-count"]) els["admin-pending-count"].textContent = padMetric(pendingRequests.length);
  if (els["admin-latest-date"]) els["admin-latest-date"].textContent = latest;
}

function padMetric(value) {
  if (value > 99) return String(value);
  return String(value).padStart(2, "0");
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function callPublicGateway(payload) {
  if (!projectUrl) {
    throw new Error("Supabase project URL is missing from the page.");
  }

  const response = await fetch(projectUrl.replace(/\/+$/, "") + "/functions/v1/" + publicFunctionName, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const parsed = await parseResponse(response);
  if (!response.ok) {
    throw new Error(parsed && parsed.error ? parsed.error : "Could not complete the request.");
  }
  return parsed;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { error: text };
  }
}
