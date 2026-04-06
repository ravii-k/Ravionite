exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: "ok"
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const projectUrl = String(process.env.SUPABASE_PROJECT_URL || "").trim().replace(/\/+$/, "");
  if (!projectUrl) {
    return json(500, { error: "SUPABASE_PROJECT_URL is missing in Netlify environment variables." });
  }

  const response = await fetch(projectUrl + "/functions/v1/public-site-gateway", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, buildForwardHeaders(event.headers || {})),
    body: event.body || "{}"
  });

  return {
    statusCode: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: await response.text()
  };
};

function buildForwardHeaders(headers) {
  const forwarded = {};
  if (headers.origin) forwarded.Origin = headers.origin;
  if (headers.referer) forwarded.Referer = headers.referer;
  if (headers["user-agent"]) forwarded["User-Agent"] = headers["user-agent"];
  if (headers["x-forwarded-for"]) forwarded["X-Forwarded-For"] = headers["x-forwarded-for"];
  if (headers["client-ip"]) forwarded["X-Forwarded-For"] = headers["client-ip"];
  return forwarded;
}

function json(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}
