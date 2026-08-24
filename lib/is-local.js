// True only for local/LAN requests, and NEVER in production unless LOCAL_DEV is
// explicitly set. This is the dev-only auth bypass - it must be gated OFF in
// prod so no stray env var can silently open the API.
//
// The check is based on the peer socket address (loopback / RFC1918), NOT the
// client-supplied Host header - a Host header is trivially spoofable, a TCP
// source address is not.
export function isLocal(req) {
  if (process.env.NODE_ENV === "production" && process.env.LOCAL_DEV !== "true") return false;
  const raw =
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) ||
    "";
  const ip = raw.replace(/^::ffff:/, "");
  if (ip === "127.0.0.1" || ip === "::1") return true;
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(ip);
}
