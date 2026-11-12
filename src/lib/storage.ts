const storageBuckets = ["covers", "avatars", "materials", "activity-materials", "submissions", "community", "feedback"] as const;
const allowedBuckets = new Set<string>(storageBuckets);
export type StorageBucket = typeof storageBuckets[number];

export function isStorageBucket(value: string): value is StorageBucket {
  return allowedBuckets.has(value);
}

export function storageFileUrl(bucket: StorageBucket, path: string | null | undefined) {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${bucket}/${encoded}`;
}

export function sanitizeStorageName(name: string) {
  const withoutAccents = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return safe || "arquivo";
}
