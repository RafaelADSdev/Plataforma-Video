import { describe, expect, it } from "vitest";

import {
  extractYouTubeVideoId,
  isValidYouTubeUrl,
  isValidYouTubeVideoId,
} from "./youtube";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("extractYouTubeVideoId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${VIDEO_ID}`, VIDEO_ID],
    [`https://youtu.be/${VIDEO_ID}`, VIDEO_ID],
    [`https://youtube.com/embed/${VIDEO_ID}`, VIDEO_ID],
    [`https://m.youtube.com/shorts/${VIDEO_ID}`, VIDEO_ID],
    [`youtube.com/watch?v=${VIDEO_ID}`, VIDEO_ID],
  ])("extrai o id de %s", (url, expected) => {
    expect(extractYouTubeVideoId(url)).toBe(expected);
  });

  it("aceita parâmetros extras e fragmento", () => {
    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/watch?feature=share&v=${VIDEO_ID}&t=75#player`,
      ),
    ).toBe(VIDEO_ID);
    expect(
      extractYouTubeVideoId(`https://youtu.be/${VIDEO_ID}?t=75#player`),
    ).toBe(VIDEO_ID);
  });

  it.each([
    `https://youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://evil.example/youtube.com/watch?v=${VIDEO_ID}`,
    `acesse youtube.com/watch?v=${VIDEO_ID}`,
    `javascript:https://youtube.com/watch?v=${VIDEO_ID}`,
    `https://user:password@youtube.com/watch?v=${VIDEO_ID}`,
  ])("rejeita URL maliciosa ou domínio imitador: %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });

  it.each([
    "https://youtube.com/watch?v=curto",
    `https://youtube.com/watch?v=${VIDEO_ID}x`,
    "https://youtu.be/dQw4w9WgXc!",
    `https://youtube.com/watch?v=${VIDEO_ID}&v=abcdefghijk`,
    `https://youtube.com/channel/${VIDEO_ID}`,
    `https://youtube.com/embed/${VIDEO_ID}/extra`,
    "",
    null,
  ])("rejeita formato ou id inválido: %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });
});

describe("validação do YouTube", () => {
  it("valida ids com os caracteres permitidos", () => {
    expect(isValidYouTubeVideoId("ab_CD-12xyz")).toBe(true);
    expect(isValidYouTubeVideoId("ab_CD-12xy")).toBe(false);
  });

  it("valida a URL completa", () => {
    expect(isValidYouTubeUrl(`https://youtu.be/${VIDEO_ID}`)).toBe(true);
    expect(isValidYouTubeUrl(`https://notyoutube.com/${VIDEO_ID}`)).toBe(false);
  });
});
