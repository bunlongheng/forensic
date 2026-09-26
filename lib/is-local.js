// True only for local/LAN requests, and only when LOCAL_DEV=true is set
// explicitly. This is the dev-only auth bypass, so it is opt-in in EVERY
// environment: `node serve.mjs` behind a reverse proxy sees every request arrive
// from 127.0.0.1, and without the explicit opt-in that would hand the whole
// internet owner rights.
//
// The check is based on the peer socket address (loopback / RFC1918), NOT the
// client-supplied Host header - a Host header is trivially spoofable, a TCP
// source address is not.
export function isLocal(req) {
  // Explicit opt-in, in every environment. .env and .github/workflows/ci.yml
  // both set it; nothing else does.
  if (process.env.LOCAL_DEV !== "true") return false;
  // No Vercel deployment (prod OR preview) ever honors the bypass, even with
  // LOCAL_DEV set - only a locally-run server (serve.mjs) can.
  if (process.env.VERCEL) return false;
  const raw =
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) ||
    "";
  const ip = raw.replace(/^::ffff:/, "");
  if (ip === "127.0.0.1" || ip === "::1") return true;
  return /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(ip);
}
