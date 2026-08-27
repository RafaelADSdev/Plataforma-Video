import Image from "next/image";
import { UserRound } from "lucide-react";
import { storageFileUrl } from "@/lib/storage";

export function UserAvatar({
  name,
  avatarPath,
  size = 28,
}: {
  name: string;
  avatarPath: string | null | undefined;
  size?: number;
}) {
  const url = storageFileUrl("avatars", avatarPath);
  return (
    <span className="user-avatar" style={{ width: size, height: size }}>
      {url ? (
        <Image src={url} alt={`Foto de ${name}`} fill sizes={`${size}px`} unoptimized />
      ) : (
        <UserRound aria-hidden="true" size={Math.round(size * 0.55)} />
      )}
    </span>
  );
}
