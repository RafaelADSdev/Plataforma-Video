import Image from "next/image";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { storageFileUrl } from "@/lib/storage";
import { communityAttachmentKindFromMime, communityAttachmentKindLabel } from "@/lib/validation";
import type { CommunityThreadAttachment } from "@/types/domain";

function sizeLabel(sizeBytes: number | null) {
  if (!sizeBytes || sizeBytes < 1) return null;
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

export function CommunityAttachments({
  attachments,
}: {
  attachments: CommunityThreadAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section className="thread-attachments" aria-labelledby="thread-attachments-title">
      <h2 id="thread-attachments-title">Anexos</h2>
      <ul className="download-list">
        {attachments.map((attachment) => {
          const url = storageFileUrl("community", attachment.storage_path);
          if (!url) return null;
          const kind = communityAttachmentKindFromMime(attachment.mime_type);
          const size = sizeLabel(attachment.size_bytes);
          return (
            <li key={attachment.id}>
              {kind === "image" ? (
                <span className="attachment-thumb">
                  <Image src={url} alt="" fill sizes="40px" unoptimized />
                </span>
              ) : (
                <FileText aria-hidden="true" size={19} />
              )}
              <span>
                <strong>{attachment.file_name}</strong>
                <small>
                  {communityAttachmentKindLabel(kind)}
                  {size ? ` · ${size}` : ""}
                </small>
              </span>
              <Link
                className="button secondary small"
                href={`${url}?nome=${encodeURIComponent(attachment.file_name)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Download aria-hidden="true" size={16} /> Abrir
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
