import type { AuthContext } from "@/lib/auth";

export function canEditCommunityPost(auth: AuthContext, authorId: string) {
  return auth.id === authorId;
}

export function canDeleteCommunityPost(auth: AuthContext, authorId: string) {
  return auth.isStaff || auth.id === authorId;
}
