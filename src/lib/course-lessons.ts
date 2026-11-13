import type { CourseLesson } from "@/types/domain";

export function hasReadyVideo(lesson?: CourseLesson) {
  return Boolean(lesson?.youtube_video_id) || lesson?.video_status === "ready";
}
