const COOKIE_NAME = "ravionite_ops_gate";

exports.handler = async function () {
  return {
    statusCode: 303,
    headers: {
      Location: "/",
      "Set-Cookie": COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    },
    body: ""
  };
};
