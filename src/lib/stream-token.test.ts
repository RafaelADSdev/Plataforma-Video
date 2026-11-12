import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createStreamPlayback } from "./stream-token";

describe("Cloudflare Stream playback", () => {
  it("signs an expiring playback URL without enabling downloads", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const encodedKey = Buffer.from(JSON.stringify(privateKey.export({ format: "jwk" }))).toString("base64");
    const uid = "b".repeat(32);
    const keyId = "a".repeat(32);
    const now = Date.parse("2026-11-12T12:00:00Z");
    const { url, expiresAt } = createStreamPlayback(uid, "course123", keyId, encodedKey, now);
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://customer-course123.cloudflarestream.com");
    expect(parsed.searchParams.get("preload")).toBe("none");
    const [header, payload, signature] = parsed.pathname.split("/")[1].split(".");
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      sub: uid, kid: keyId, exp: (now + 1_800_000) / 1000, downloadable: false,
    });
    expect(expiresAt).toBe(now + 1_800_000);
  });

  it("rejects a customer value that could change the playback host", () => {
    expect(() => createStreamPlayback("b".repeat(32), "example.com/", "a".repeat(32), "")).toThrow();
  });
});
