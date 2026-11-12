import "server-only";
import { streamUidPattern } from "@/lib/stream-token";

type StreamVideo = {
  uid: string;
  readyToStream?: boolean;
  requireSignedURLs?: boolean;
  allowedOrigins?: string[];
  status?: { state?: string };
};

export class StreamError extends Error {
  constructor(public readonly status: number) {
    super("A operação de vídeo falhou.");
  }
}

function allowedOrigins() {
  const origins = [...new Set((process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS ?? "")
    .split(",").map((origin) => origin.trim().toLowerCase()).filter(Boolean))];
  if (!origins.length || origins.some((origin) => !/^[a-z0-9.-]+(?::[0-9]+)?$/.test(origin))) {
    throw new StreamError(503);
  }
  return origins;
}

async function streamRequest(path: string, init: RequestInit = {}) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!streamUidPattern.test(account) || !apiToken) throw new StreamError(503);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiToken}`);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream${path}`, {
    ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new StreamError(response.status);
  return response;
}

export async function createStreamUpload(size: number, title: string, expiresAt: string) {
  allowedOrigins();
  const metadata = (key: string, value: string) => `${key} ${Buffer.from(value).toString("base64")}`;
  const maxDuration = Number(process.env.CLOUDFLARE_STREAM_MAX_DURATION_SECONDS ?? 14400);
  if (!Number.isInteger(maxDuration) || maxDuration < 1 || maxDuration > 36000) throw new StreamError(503);
  const response = await streamRequest("?direct_user=true", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": [
        metadata("name", title),
        metadata("maxDurationSeconds", String(maxDuration)),
        metadata("expiry", expiresAt),
        "requiresignedurls",
      ].join(","),
    },
  });
  const uid = response.headers.get("stream-media-id");
  const location = response.headers.get("location");
  if (!uid || !streamUidPattern.test(uid) || !location) throw new StreamError(502);
  const url = new URL(location);
  if (url.protocol !== "https:" || url.username || url.password) throw new StreamError(502);
  return { uid, url: url.href };
}

async function readVideoResponse(response: Response, uid: string) {
  const { success, result } = await response.json() as { success?: boolean; result?: StreamVideo };
  if (!success || result?.uid !== uid) throw new StreamError(502);
  return result;
}

export async function getStreamVideo(uid: string) {
  if (!streamUidPattern.test(uid)) throw new StreamError(502);
  return readVideoResponse(await streamRequest(`/${uid}`), uid);
}

export async function ensurePrivateStream(video: StreamVideo) {
  const origins = allowedOrigins();
  const verified = (record: StreamVideo) => record.requireSignedURLs === true
    && record.allowedOrigins?.length === origins.length
    && origins.every((origin) => record.allowedOrigins?.includes(origin));
  if (verified(video)) return;
  const response = await streamRequest(`/${video.uid}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requireSignedURLs: true, allowedOrigins: origins }),
  });
  if (!verified(await readVideoResponse(response, video.uid))) throw new StreamError(502);
}

export async function discardStreamUpload(uid: string) {
  if (!streamUidPattern.test(uid)) return;
  try {
    await streamRequest(`/${uid}`, { method: "DELETE" });
  } catch {
    // The abandoned upload was never selected for playback. Its URL expires.
  }
}
