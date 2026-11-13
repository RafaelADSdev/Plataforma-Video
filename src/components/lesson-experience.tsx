"use client";

import { Check, Film, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { createLessonCommentAction } from "@/app/actions/lessons";
import { PrivateVideoPlayer, type PlaybackCoverage, type VideoCheckpoint, type VideoControls } from "@/components/private-video-player";
import { UserAvatar } from "@/components/user-avatar";
import { YouTubeVideoPlayer } from "@/components/youtube-video-player";
import { publicDisplayName } from "@/lib/profile-name";
import { formatVideoTime } from "@/lib/time";
import type { Comment, Lesson } from "@/types/domain";

export function LessonExperience({
  lessonId, lessonTitle, videoStatus, youtubeVideoId, initialSeconds, initialWatched, canTrack, requiresPlayback, comments, curriculum, children,
}: {
  lessonId: string;
  lessonTitle: string;
  videoStatus: Lesson["video_status"];
  youtubeVideoId: string | null;
  initialSeconds: number;
  initialWatched: boolean;
  canTrack: boolean;
  requiresPlayback: boolean;
  comments: Comment[];
  curriculum: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const playable = Boolean(youtubeVideoId) || videoStatus === "ready";
  const videoRef = useRef<VideoControls>(null);
  const playerSectionRef = useRef<HTMLElement>(null);
  const progressQueue = useRef(Promise.resolve());
  const watchedRef = useRef(initialWatched);
  const suppressAutoMark = useRef(false);
  const [watched, setWatched] = useState(initialWatched);
  const [manualPending, setManualPending] = useState(false);
  const [resumeVisible, setResumeVisible] = useState(initialSeconds > 0 && !initialWatched);
  const [progressError, setProgressError] = useState("");
  const [comment, setComment] = useState("");
  const [commentMessage, setCommentMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [commentPending, startCommentTransition] = useTransition();

  const persist = useCallback((lastSeconds: number, complete: boolean, manual = false, playback?: PlaybackCoverage) => {
    const operation = progressQueue.current.then(async () => {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, lastSeconds: Math.min(24 * 60 * 60, lastSeconds), watched: complete, manual, playback }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("progresso");
      const { watched: saved } = await response.json() as { watched: boolean };
      const changed = watchedRef.current !== saved;
      watchedRef.current = saved;
      setWatched(saved);
      setProgressError("");
      if (changed) router.refresh();
    });
    progressQueue.current = operation.catch(() => {
      setProgressError("Não foi possível salvar o progresso. Tente novamente.");
    });
    return operation;
  }, [lessonId, router]);

  const checkpoint = useCallback<VideoCheckpoint>((seconds, duration, ended, coverage) => {
    if (!canTrack) return;
    const completed = !requiresPlayback && !suppressAutoMark.current && (ended || (duration > 0 && seconds / duration >= 0.9));
    void persist(seconds, completed, false, watchedRef.current ? undefined : coverage).catch(() => { /* The error appears below the player. */ });
  }, [canTrack, persist, requiresPlayback]);

  function seek(seconds: number) {
    videoRef.current?.seek(seconds);
    playerSectionRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  return (
    <>
      <div className="classroom-player">
        {youtubeVideoId || videoStatus !== "none" ? (
          <section ref={playerSectionRef} className="player-section" aria-label="Vídeo da aula">
            {youtubeVideoId ? (
              <YouTubeVideoPlayer key={youtubeVideoId} ref={videoRef} videoId={youtubeVideoId} title={lessonTitle}
                startAt={initialWatched ? 0 : initialSeconds} trackCoverage={requiresPlayback} onCheckpoint={checkpoint} />
            ) : playable ? (
              <PrivateVideoPlayer ref={videoRef} lessonId={lessonId} title={lessonTitle}
                startAt={initialWatched ? 0 : initialSeconds} trackCoverage={requiresPlayback} onCheckpoint={checkpoint} />
            ) : (
              <div className="video-frame"><div className="video-placeholder">
                <Film size={29} aria-hidden="true" /><p>Gravação ainda indisponível</p>
                <span>{canTrack ? "O material e as atividades da aula estão abaixo." : "Abra a edição da aula para acompanhar a gravação."}</span>
              </div></div>
            )}
            {playable && resumeVisible ? <div className="resume-notice" role="status">
              <span><RotateCcw size={16} aria-hidden="true" /> Retomando de {formatVideoTime(initialSeconds)}</span>
              <button type="button" aria-label="Dispensar aviso de retomada" onClick={() => setResumeVisible(false)}><X size={17} aria-hidden="true" /></button>
            </div> : null}
          </section>
        ) : null}
        {canTrack ? (
          <div className="progress-actions">
            {requiresPlayback ? (
              <p className={watched ? "badge success" : "meta"} role="status">
                {watched ? <><Check size={17} aria-hidden="true" /> Aula concluída</> : "Assista a pelo menos 90% do vídeo para concluir esta aula."}
              </p>
            ) : <button className={`button ${watched ? "secondary" : ""}`} type="button" disabled={manualPending} onClick={async () => {
              const next = !watchedRef.current;
              suppressAutoMark.current = !next;
              setManualPending(true);
              try {
                await persist(videoRef.current?.seconds() ?? initialSeconds, next, true);
              } catch {
                suppressAutoMark.current = false;
              } finally {
                setManualPending(false);
              }
            }}><Check size={17} aria-hidden="true" /> {manualPending ? "Salvando…" : watched ? "Desmarcar conclusão" : "Marcar como concluída"}</button>}
            {progressError ? <p className="field-error" role="alert">{progressError}</p> : null}
          </div>
        ) : null}
      </div>
      {curriculum}
      <div className="classroom-content">
        {children}
        <section className="comments-section" aria-labelledby="comments-title">
          <div className="section-heading"><h2 id="comments-title">Comentários da aula</h2></div>
          <form className="comment-form" onSubmit={(event) => {
            event.preventDefault();
            const body = comment.trim();
            if (!body) {
              setCommentMessage({ ok: false, message: "Escreva o comentário antes de enviar." });
              return;
            }
            const seconds = videoRef.current?.seconds() ?? null;
            startCommentTransition(async () => {
              try {
                const result = await createLessonCommentAction(lessonId, body, seconds);
                setCommentMessage({ ok: result.ok, message: result.message ?? "" });
                if (result.ok) {
                  setComment("");
                  router.refresh();
                }
              } catch {
                setCommentMessage({ ok: false, message: "Não foi possível enviar o comentário." });
              }
            });
          }}>
            <div className="field"><label htmlFor="lesson-comment">Novo comentário</label>
              <textarea className="textarea" id="lesson-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} />
            </div>
            {commentMessage?.message ? <p className={`form-message${commentMessage.ok ? " form-success" : ""}`} role={commentMessage.ok ? "status" : "alert"}>{commentMessage.message}</p> : null}
            <button className="button" type="submit" disabled={commentPending}>{commentPending ? "Enviando…" : "Comentar"}</button>
          </form>
          {comments.length === 0 ? <p className="muted">Ainda não há comentários.</p> : (
            <ol className="comment-list">
              {comments.map((item) => {
                const authorName = publicDisplayName(item.profiles?.display_name);
                const time = item.t_seconds === null ? null : formatVideoTime(item.t_seconds);
                return <li key={item.id} className="comment-item">
                  <div className="comment-meta">
                    <UserAvatar name={authorName} avatarPath={item.profiles?.avatar_path} size={28} /><strong>{authorName}</strong>
                    {time && playable ? <button className="timestamp" type="button" aria-label={`Ir para ${time}`} onClick={() => seek(item.t_seconds!)}>{time}</button> : time ? <span className="meta">{time}</span> : null}
                  </div>
                  <p>{item.body}</p>
                </li>;
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
