export const MEBIBYTE = 1_024 * 1_024;

export const FILE_SIZE_LIMITS = {
  cover: 5 * MEBIBYTE,
  avatar: 5 * MEBIBYTE,
  material: 20 * MEBIBYTE,
  submission: 20 * MEBIBYTE,
  community: 20 * MEBIBYTE,
} as const;

export const MAX_COMMUNITY_ATTACHMENTS = 5;

export const COMMUNITY_ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
].join(",");

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ALLOWED_PDF_MIME_TYPES = ["application/pdf"] as const;
export const ALLOWED_SUBMISSION_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_PDF_MIME_TYPES,
] as const;

export type AllowedFileExtension =
  | "jpg"
  | "jpeg"
  | "png"
  | "webp"
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "txt";
export type AllowedFileKind = "image" | "pdf" | "word" | "sheet" | "slides" | "text";
export type FileValidationErrorCode =
  | "invalid_file"
  | "empty_file"
  | "too_large"
  | "unsupported_type"
  | "mime_extension_mismatch";

export type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

export type FileValidationResult =
  | {
      ok: true;
      extension: AllowedFileExtension;
      kind: AllowedFileKind;
      mimeType: string;
    }
  | {
      ok: false;
      code: FileValidationErrorCode;
      error: string;
    };

type AllowedFileRule = {
  extension: AllowedFileExtension;
  mimeType: string;
  kind: AllowedFileKind;
};

const IMAGE_RULES: readonly AllowedFileRule[] = [
  { extension: "jpg", mimeType: "image/jpeg", kind: "image" },
  { extension: "jpeg", mimeType: "image/jpeg", kind: "image" },
  { extension: "png", mimeType: "image/png", kind: "image" },
  { extension: "webp", mimeType: "image/webp", kind: "image" },
];

const PDF_RULES: readonly AllowedFileRule[] = [
  { extension: "pdf", mimeType: "application/pdf", kind: "pdf" },
];

const SUBMISSION_RULES = [...IMAGE_RULES, ...PDF_RULES] as const;

const COMMUNITY_RULES: readonly AllowedFileRule[] = [
  ...SUBMISSION_RULES,
  { extension: "doc", mimeType: "application/msword", kind: "word" },
  {
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "word",
  },
  { extension: "xls", mimeType: "application/vnd.ms-excel", kind: "sheet" },
  {
    extension: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "sheet",
  },
  { extension: "ppt", mimeType: "application/vnd.ms-powerpoint", kind: "slides" },
  {
    extension: "pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "slides",
  },
  { extension: "txt", mimeType: "text/plain", kind: "text" },
];

const COMMUNITY_MIME_BY_EXTENSION = Object.fromEntries(
  COMMUNITY_RULES.map((rule) => [rule.extension, rule.mimeType]),
) as Record<AllowedFileExtension, string>;

function failure(
  code: FileValidationErrorCode,
  error: string,
): FileValidationResult {
  return { ok: false, code, error };
}

export function getFileExtension(name: string): string | null {
  const match = name.trim().match(/\.([A-Za-z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
}

function validateFile(
  file: FileMetadata,
  rules: readonly AllowedFileRule[],
  maximumBytes: number,
  acceptedDescription: string,
): FileValidationResult {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.type !== "string" ||
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    file.size < 0
  ) {
    return failure("invalid_file", "Não foi possível validar o arquivo.");
  }

  if (file.size === 0) {
    return failure("empty_file", "O arquivo está vazio.");
  }

  if (file.size > maximumBytes) {
    return failure(
      "too_large",
      `O arquivo deve ter no máximo ${maximumBytes / MEBIBYTE} MB.`,
    );
  }

  const extension = getFileExtension(file.name);
  const reportedMime = file.type.trim().toLowerCase();
  const mimeType =
    extension &&
    (!reportedMime ||
      reportedMime === "application/octet-stream" ||
      reportedMime === "binary/octet-stream") &&
    extension in COMMUNITY_MIME_BY_EXTENSION
      ? COMMUNITY_MIME_BY_EXTENSION[extension as AllowedFileExtension]
      : reportedMime;
  const extensionIsAllowed = rules.some(
    (rule) => rule.extension === extension,
  );
  const mimeTypeIsAllowed = rules.some((rule) => rule.mimeType === mimeType);

  if (!extensionIsAllowed || !mimeTypeIsAllowed) {
    return failure("unsupported_type", `Envie ${acceptedDescription}.`);
  }

  const matchingRule = rules.find(
    (rule) => rule.extension === extension && rule.mimeType === mimeType,
  );

  if (!matchingRule) {
    return failure(
      "mime_extension_mismatch",
      "O tipo MIME não corresponde à extensão do arquivo.",
    );
  }

  return {
    ok: true,
    extension: matchingRule.extension,
    kind: matchingRule.kind,
    mimeType,
  };
}

export function validateCoverFile(file: FileMetadata): FileValidationResult {
  return validateFile(
    file,
    IMAGE_RULES,
    FILE_SIZE_LIMITS.cover,
    "uma imagem JPG, PNG ou WebP",
  );
}

export function validateAvatarFile(file: FileMetadata): FileValidationResult {
  return validateFile(
    file,
    IMAGE_RULES,
    FILE_SIZE_LIMITS.avatar,
    "uma imagem JPG, PNG ou WebP",
  );
}

export function validateMaterialFile(file: FileMetadata): FileValidationResult {
  return validateFile(
    file,
    PDF_RULES,
    FILE_SIZE_LIMITS.material,
    "um arquivo PDF",
  );
}

export function validateSubmissionFile(
  file: FileMetadata,
): FileValidationResult {
  return validateFile(
    file,
    SUBMISSION_RULES,
    FILE_SIZE_LIMITS.submission,
    "um PDF ou uma imagem JPG, PNG ou WebP",
  );
}

export function validateCommunityAttachmentFile(
  file: FileMetadata,
): FileValidationResult {
  return validateFile(
    file,
    COMMUNITY_RULES,
    FILE_SIZE_LIMITS.community,
    "um PDF, uma imagem, um arquivo do Word, Excel, PowerPoint ou um TXT",
  );
}

export function communityAttachmentKindLabel(kind: AllowedFileKind) {
  switch (kind) {
    case "image":
      return "Imagem";
    case "pdf":
      return "PDF";
    case "word":
      return "Word";
    case "sheet":
      return "Excel";
    case "slides":
      return "PowerPoint";
    case "text":
      return "Texto";
  }
}

export function communityAttachmentKindFromMime(mimeType: string): AllowedFileKind {
  const match = COMMUNITY_RULES.find((rule) => rule.mimeType === mimeType.toLowerCase());
  return match?.kind ?? "text";
}
