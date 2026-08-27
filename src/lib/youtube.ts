const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_YOUTUBE_URL_LENGTH = 2_048;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

const SHORT_YOUTUBE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

/**
 * Checks the shape of a YouTube video id without making a network request.
 */
export function isValidYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && YOUTUBE_VIDEO_ID_PATTERN.test(value);
}

function parseUrl(value: string): URL | null {
  const candidate = value.trim();
  const hasControlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

  if (
    candidate.length === 0 ||
    candidate.length > MAX_YOUTUBE_URL_LENGTH ||
    hasControlCharacter
  ) {
    return null;
  }

  // Accept pasted URLs without a protocol, but only when they already begin
  // with one of the exact supported hosts. This must not turn arbitrary text
  // containing "youtube.com" into a URL.
  const hasScheme = /^[A-Za-z][A-Za-z\d+.-]*:/.test(candidate);
  const hasKnownHostWithoutScheme = /^(?:(?:www|m)\.)?youtube\.com(?:[/?#]|$)|^(?:www\.)?youtu\.be(?:[/?#]|$)/i.test(
    candidate,
  );

  if (!hasScheme && !hasKnownHostWithoutScheme) {
    return null;
  }

  try {
    const url = new URL(hasScheme ? candidate : `https://${candidate}`);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== ""
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

/**
 * Extracts an id from the four URL shapes supported by the product:
 * youtube.com/watch?v=, youtu.be/, youtube.com/embed/ and
 * youtube.com/shorts/. Lookalike domains and ambiguous ids are rejected.
 */
export function extractYouTubeVideoId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const hostname = url.hostname.toLowerCase();

  if (SHORT_YOUTUBE_HOSTS.has(hostname)) {
    const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
    return match && isValidYouTubeVideoId(match[1]) ? match[1] : null;
  }

  if (!YOUTUBE_HOSTS.has(hostname)) {
    return null;
  }

  if (url.pathname === "/watch" || url.pathname === "/watch/") {
    const videoIds = url.searchParams.getAll("v");
    return videoIds.length === 1 && isValidYouTubeVideoId(videoIds[0])
      ? videoIds[0]
      : null;
  }

  const match = url.pathname.match(
    /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/,
  );

  return match && isValidYouTubeVideoId(match[1]) ? match[1] : null;
}

export function isValidYouTubeUrl(value: unknown): value is string {
  return extractYouTubeVideoId(value) !== null;
}
