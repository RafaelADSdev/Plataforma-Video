"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createLessonCommentAction } from "@/app/actions/lessons";
import { UserAvatar } from "@/components/user-avatar";
import { publicDisplayName } from "@/lib/profile-name";
import { formatVideoTime } from "@/lib/time";
import type { Comment } from "@/types/domain";

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export function LessonExperience({
  lessonId,
  lessonTitle,
  videoId,
  initialSeconds,
  initialWatched,
  canTrack,
  comments,
  children,
}: {
  lessonId: string;
  lessonTitle: string;
  videoId: string | null;
  initialSeconds: number;
  initialWatched: boolean;
  canTrack: boolean;
  comments: Comment[];
  children: React.ReactNode;
}) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const playerSectionRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchedRef = useRef(initialWatched);
  const autoMarkSuppressedRef = useRef(false);
  const [watched, setWatched] = useState(initialWatched);
  const [resumeVisible, setResumeVisible] = useState(initialSeconds > 0 && !initialWatched);
  const [progressError, setProgressError] = useState("");
  const [comment, setComment] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentPending, startCommentTransition] = useTransition();
  const router = useRouter();

  const persistProgress = useCallback(async (manual = false, watchedValue?: boolean) => {
    if (!canTrack || !playerRef.current) return;
    const lastSeconds = Math.max(0, Math.floor(playerRef.current.getCurrentTime() || 0));
    const duration = Math.max(0, playerRef.current.getDuration() || 0);
    const reachedNinetyPercent = !autoMarkSuppressedRef.current && duration > 0 && lastSeconds / duration >= 0.9;
    const nextWatched = watchedValue ?? (watchedRef.current || reachedNinetyPercent);

    if (nextWatched && !watchedRef.current) {
      watchedRef.current = true;
      setWatched(true);
    }

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, lastSeconds, watched: nextWatched, manual }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("progress");
      const data = await response.json() as { watched?: boolean };
      if (typeof data.watched === "boolean") {
        watchedRef.current = data.watched;
        setWatched(data.watched);
      }
      setProgressError("");
    } catch {
      setProgressError("Não foi possível salvar o ponto da aula agora.");
    }
  }, [canTrack, lessonId]);

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;
    let cancelled = false;
    const host = playerHostRef.current;

    void loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady(event) {
            event.target.getIframe().setAttribute("title", `Player da aula ${lessonTitle}`);
            if (initialSeconds > 0 && !initialWatched) event.target.seekTo(initialSeconds, true);
          },
          onStateChange(event) {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                void persistProgress();
              }, 10_000);
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = null;
              if (event.data === window.YT?.PlayerState.PAUSED || event.data === window.YT?.PlayerState.ENDED) {
                void persistProgress(false, event.data === window.YT?.PlayerState.ENDED ? true : undefined);
              }
            }
          },
        },
      });
    });

    const saveOnExit = () => { void persistProgress(); };
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") saveOnExit(); };
    window.addEventListener("pagehide", saveOnExit);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("pagehide", saveOnExit);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      void persistProgress();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [initialSeconds, initialWatched, lessonTitle, persistProgress, videoId]);

  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {videoId ? (
        <section ref={playerSectionRef} className="player-section" aria-label="Vídeo da aula">
          <div className="video-frame"><div ref={playerHostRef} /></div>
          {resumeVisible ? (
            <div className="resume-notice" role="status">
              <span><RotateCcw aria-hidden="true" size={16} /> Continuando de {formatVideoTime(initialSeconds)}</span>
              <button type="button" aria-label="Dispensar aviso de retomada" onClick={() => setResumeVisible(false)}><X aria-hidden="true" size={17} /></button>
            </div>
          ) : null}
          <p className="player-note">O ponto da aula é salvo aqui. Se também usa o YouTube logado, ligue o histórico por lá — no embed isso não substitui o nosso progresso.</p>
          {canTrack ? (
            <div className="progress-actions">
              <button className={`button ${watched ? "secondary" : ""}`} type="button" onClick={async () => {
                const next = !watchedRef.current;
                autoMarkSuppressedRef.current = !next;
                watchedRef.current = next;
                setWatched(next);
                await persistProgress(true, next);
                router.refresh();
              }}>
                <Check aria-hidden="true" size={17} /> {watched ? "Desmarcar como visto" : "Marcar como visto"}
              </button>
              {progressError ? <p className="field-error" role="alert">{progressError}</p> : null}
            </div>
          ) : null}
        </section>
      ) : canTrack ? (
        <div className="progress-actions no-video-progress">
          <button className={`button ${watched ? "secondary" : ""}`} type="button" onClick={async () => {
            const next = !watchedRef.current;
            watchedRef.current = next;
            setWatched(next);
            try {
              const response = await fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lessonId, lastSeconds: initialSeconds, watched: next, manual: true }),
              });
              if (!response.ok) throw new Error("progress");
              setProgressError("");
              router.refresh();
            } catch {
              setProgressError("Não foi possível atualizar o status da aula.");
            }
          }}><Check aria-hidden="true" size={17} /> {watched ? "Desmarcar como visto" : "Marcar como visto"}</button>
          {progressError ? <p className="field-error" role="alert">{progressError}</p> : null}
        </div>
      ) : null}

      {children}

      <section className="comments-section" aria-labelledby="comments-title">
        <div className="section-heading"><div><h2 id="comments-title">Comentários da aula</h2><p className="muted">Compartilhe uma observação com a turma.</p></div></div>
        <form className="comment-form" onSubmit={(event) => {
          event.preventDefault();
          const body = comment.trim();
          if (!body) {
            setCommentMessage("Escreva o comentário antes de enviar.");
            return;
          }
          const seconds = videoId && playerRef.current ? Math.floor(playerRef.current.getCurrentTime()) : null;
          startCommentTransition(async () => {
            const result = await createLessonCommentAction(lessonId, body, seconds);
            setCommentMessage(result.message ?? "");
            if (result.ok) {
              setComment("");
              router.refresh();
            }
          });
        }}>
          <div className="field"><label htmlFor="lesson-comment">Novo comentário</label><textarea className="textarea" id="lesson-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} /></div>
          {commentMessage ? <p className={`form-message${comment === "" ? " form-success" : ""}`} role="status">{commentMessage}</p> : null}
          <button className="button" type="submit" disabled={commentPending}>{commentPending ? "Enviando comentário…" : "Comentar"}</button>
        </form>
        {comments.length === 0 ? (
          <div className="empty-state compact"><h3>Ainda não há comentários</h3><p className="muted">Seja a primeira pessoa a comentar esta aula.</p></div>
        ) : (
          <ol className="comment-list">
            {comments.map((item) => {
              const authorName = publicDisplayName(item.profiles?.display_name);
              return (
                <li key={item.id} className="comment-item">
                  <div className="comment-meta">
                    <UserAvatar name={authorName} avatarPath={item.profiles?.avatar_path} size={28} />
                    <strong>{authorName}</strong>
                    {videoId && item.t_seconds !== null ? (
                      <button className="timestamp" type="button" aria-label={`Ir para ${formatVideoTime(item.t_seconds)}`} onClick={() => seekTo(item.t_seconds ?? 0)}>{formatVideoTime(item.t_seconds)}</button>
                    ) : null}
                  </div>
                  <p>{item.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
