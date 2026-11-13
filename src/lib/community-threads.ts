import type { Thread } from "@/types/domain";

export const communityThreadFields = "id,course_id,author_id,title,body,created_at,like_count,my_like:community_thread_likes(thread_id)";

export type ThreadWithLikes = Thread & {
  like_count: number;
  my_like: { thread_id: string }[];
};
