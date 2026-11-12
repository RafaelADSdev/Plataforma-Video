import { createPrivateKey, sign } from "node:crypto";

export const streamUidPattern = /^[0-9a-f]{32}$/;
const tokenLifetimeSeconds = 30 * 60;

export function createStreamPlayback(
  uid: string,
  customerCode: string,
  keyId: string,
  encodedJwk: string,
  now = Date.now(),
) {
  if (!streamUidPattern.test(uid) || !/^[a-z0-9]+$/.test(customerCode) || !streamUidPattern.test(keyId)) {
    throw new Error("Configuração inválida de reprodução.");
  }
  const jwk = JSON.parse(Buffer.from(encodedJwk, "base64").toString("utf8"));
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const exp = Math.floor(now / 1000) + tokenLifetimeSeconds;
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: uid, kid: keyId, exp, downloadable: false })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url");
  const url = new URL(`https://customer-${customerCode}.cloudflarestream.com/${unsigned}.${signature}/iframe`);
  url.searchParams.set("preload", "none");
  return { url: url.href, expiresAt: exp * 1000 };
}
