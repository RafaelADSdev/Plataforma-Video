import type { Role } from "@/lib/auth";

export type Course = {
  id: string;
  title: string;
  description: string | null;
  cover_path: string | null;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  position: number;
  scheduled_for: string | null;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content: string;
  youtube_url: string | null;
  position: number;
  published_at: string;
  scheduled_for: string | null;
};

export type Activity = {
  id: string;
  module_id: string;
  lesson_id: string | null;
  kind: "file" | "quiz";
  title: string;
  instructions: string;
  position: number;
  published_at: string | null;
  due_at: string | null;
  support_path: string | null;
  support_name: string | null;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId?: string;
};

export type ActivityQuiz = {
  revision: string;
  questions: QuizQuestion[];
  allowRetries: boolean;
  showAnswers: boolean;
  hasAttempt: boolean;
};

export type QuizAttempt = {
  id: string;
  user_id: string;
  attempt_number: number;
  answers: Record<string, string>;
  correct_count: number;
  question_count: number;
  created_at: string;
};

export type Material = {
  id: string;
  lesson_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
};

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
};

export type Progress = {
  lesson_id: string;
  user_id: string;
  last_seconds: number;
  watched: boolean;
  updated_at: string;
};

export type Comment = {
  id: string;
  lesson_id: string;
  author_id: string;
  body: string;
  t_seconds: number | null;
  created_at: string;
  profiles?: Pick<Profile, "display_name" | "avatar_path"> | null;
};

export type Thread = {
  id: string;
  course_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  profiles?: Pick<Profile, "display_name" | "avatar_path"> | null;
};

export type Reply = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  profiles?: Pick<Profile, "display_name" | "avatar_path"> | null;
};

export type CommunityThreadAttachment = {
  id: string;
  thread_id: string;
  author_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
};

export type Submission = {
  id: string;
  activity_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "display_name" | "avatar_path"> | null;
};

export type SubmissionMessage = {
  id: string;
  activity_id: string;
  student_id: string;
  author_id: string;
  body: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  profiles?: Pick<Profile, "display_name" | "avatar_path"> | null;
};

export type WeeklyScheduleSlot = {
  id: string;
  course_id: string;
  owner_id: string | null;
  weekday: number;
  starts_at: string;
  ends_at: string | null;
  note: string;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  type: "comment" | "community" | "submission" | "feedback";
  lesson_id: string | null;
  thread_id: string | null;
  comment_id: string | null;
  submission_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};
