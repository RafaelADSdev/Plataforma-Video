import { describe, expect, it } from "vitest";

import {
  FILE_SIZE_LIMITS,
  validateAvatarFile,
  validateCommunityAttachmentFile,
  validateCoverFile,
  validateMaterialFile,
  validateSubmissionFile,
  type FileMetadata,
} from "./validation";

function file(
  name: string,
  type: string,
  size = 1_024,
): FileMetadata {
  return { name, type, size };
}

describe("validação de imagens", () => {
  it.each([
    ["capa.jpg", "image/jpeg"],
    ["capa.JPEG", "IMAGE/JPEG"],
    ["capa.png", "image/png"],
    ["capa.webp", "image/webp"],
  ])("aceita %s com MIME %s", (name, type) => {
    expect(validateCoverFile(file(name, type))).toMatchObject({
      ok: true,
      kind: "image",
    });
  });

  it("aplica o limite de tamanho e rejeita arquivo vazio", () => {
    expect(
      validateAvatarFile(
        file("foto.png", "image/png", FILE_SIZE_LIMITS.avatar),
      ).ok,
    ).toBe(true);
    expect(
      validateAvatarFile(
        file("foto.png", "image/png", FILE_SIZE_LIMITS.avatar + 1),
      ),
    ).toEqual({
      ok: false,
      code: "too_large",
      error: "O arquivo deve ter no máximo 5 MB.",
    });
    expect(validateAvatarFile(file("foto.png", "image/png", 0))).toMatchObject(
      {
        ok: false,
        code: "empty_file",
      },
    );
  });
});

describe("validação de materiais", () => {
  it("aceita apenas PDF coerente", () => {
    expect(validateMaterialFile(file("apostila.PDF", "application/pdf"))).toEqual(
      {
        ok: true,
        extension: "pdf",
        kind: "pdf",
        mimeType: "application/pdf",
      },
    );
    expect(validateMaterialFile(file("apostila.exe", "application/pdf"))).toMatchObject(
      {
        ok: false,
        code: "unsupported_type",
      },
    );
  });
});

describe("validação de entregas", () => {
  it.each([
    ["atividade.pdf", "application/pdf", "pdf"],
    ["atividade.jpg", "image/jpeg", "image"],
    ["atividade.png", "image/png", "image"],
    ["atividade.webp", "image/webp", "image"],
  ])("aceita %s", (name, type, kind) => {
    expect(validateSubmissionFile(file(name, type))).toMatchObject({
      ok: true,
      kind,
    });
  });

  it.each([
    ["atividade.png", "image/jpeg"],
    ["atividade.pdf", "image/png"],
    ["atividade.jpg", "application/pdf"],
  ])("rejeita divergência entre extensão e MIME: %s / %s", (name, type) => {
    expect(validateSubmissionFile(file(name, type))).toEqual({
      ok: false,
      code: "mime_extension_mismatch",
      error: "O tipo MIME não corresponde à extensão do arquivo.",
    });
  });

  it("recusa formatos fora da lista com erro em português", () => {
    expect(
      validateSubmissionFile(file("atividade.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    ).toEqual({
      ok: false,
      code: "unsupported_type",
      error: "Envie um PDF ou uma imagem JPG, PNG ou WebP.",
    });
  });
});

describe("validação de anexos da comunidade", () => {
  it.each([
    ["foto.jpg", "image/jpeg", "image"],
    ["apostila.pdf", "application/pdf", "pdf"],
    ["relato.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word"],
    ["planilha.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "sheet"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "slides"],
    ["notas.txt", "text/plain", "text"],
  ])("aceita %s", (name, type, kind) => {
    expect(validateCommunityAttachmentFile(file(name, type))).toMatchObject({
      ok: true,
      kind,
    });
  });

  it("aceita Word e imagem quando o navegador envia octet-stream", () => {
    expect(
      validateCommunityAttachmentFile(
        file("relato.docx", "application/octet-stream"),
      ),
    ).toMatchObject({
      ok: true,
      extension: "docx",
      kind: "word",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(
      validateCommunityAttachmentFile(file("foto.png", "application/octet-stream")),
    ).toMatchObject({
      ok: true,
      kind: "image",
      mimeType: "image/png",
    });
  });

  it("recusa executável mesmo com octet-stream", () => {
    expect(
      validateCommunityAttachmentFile(file("malware.exe", "application/octet-stream")),
    ).toMatchObject({
      ok: false,
      code: "unsupported_type",
    });
  });
});
