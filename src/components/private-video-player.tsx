"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

type StreamPlayer = {
  currentTime: number;
  duration: number;
  paused: boolean;
  play(): Promise<void>;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
};

type StreamWindow = Window & { Stream?: (frame: HTMLIFrameElement) => StreamPlayer };
type Authorization = { url: string; expiresAt: number };

export type VideoControls = {
  seek(seconds: number): void;
  seconds(): number | null;
};

let sdk: Promise<void> | null = null;
function loadStreamSdk() {
  if ((window as StreamWindow).Stream) return Promise.resolve();
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const failed = () => {
      clearTimeout(timeout);
      script.remove();
      sdk = null;
      reject(new Error("Não foi possível carregar o player."));
    };
    const timeout = setTimeout(failed, 12_000);
    script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    script.async = true;
    script.onload = () => {
      if (!(window as StreamWindow).Stream) {
        failed();
        return;
      }
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = failed;
    document.head.appendChild(script);
  });
  return sdk;
}

export function PrivateVideoPlayer({
  ref, lessonId, title, startAt, onCheckpoint,
}: {
  ref: Ref<VideoControls>;
  lessonId: string;
  title: string;
  startAt: number;
  onCheckpoint: (seconds: number, duration: number, ended: boolean) => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const player = useRef<StreamPlayer | null>(null);
  const playerState = useRef({ seconds: startAt, initialized: false, resumePlaying: false });
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(0);

  useImperativeHandle(ref, () => ({
    seek(seconds) {
      playerState.current.seconds = seconds;
      if (player.current && playerState.current.initialized) {
        player.current.currentTime = Math.min(seconds, player.current.duration || seconds);
      }
    },
    seconds() {
      return playerState.current.initialized ? playerState.current.seconds : null;
    },
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function authorize() {
      try {
        const response = await fetch(`/api/lessons/${lessonId}/playback`, { method: "POST", signal: controller.signal });
        const next = await response.json() as Authorization & { error?: string };
        if (!response.ok || !next.url || !next.expiresAt) throw new Error(next.error ?? "Não foi possível liberar o vídeo.");
        await loadStreamSdk();
        if (controller.signal.aborted) return;
        if (player.current && playerState.current.initialized) {
          playerState.current.resumePlaying = !player.current.paused;
        }
        setError("");
        setAuthorization(next);
        timer = setTimeout(authorize, Math.max(1_000, next.expiresAt - Date.now() - 60_000));
      } catch (cause) {
        if (controller.signal.aborted) return;
        setAuthorization(null);
        setError(cause instanceof Error ? cause.message : "Não foi possível liberar o vídeo.");
      }
    }
    void authorize();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [lessonId, request]);

  useEffect(() => {
    const stream = (window as StreamWindow).Stream;
    if (!authorization || !iframe.current || !stream) return;
    const instance = stream(iframe.current);
    const timeline = playerState.current;
    player.current = instance;
    timeline.initialized = false;
    let lastCheckpoint = Date.now();
    let changed = false;
    const initialized = () => {
      if (timeline.initialized) return;
      const duration = Number(instance.duration);
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (timeline.seconds > 0) {
        instance.currentTime = Math.min(timeline.seconds, Math.max(0, duration - 0.25));
      }
      timeline.initialized = true;
      if (timeline.resumePlaying) {
        timeline.resumePlaying = false;
        void instance.play().catch(() => { /* Browser controls remain available if autoplay is blocked. */ });
      }
    };
    const save = (ended = false) => {
      if (!timeline.initialized || (!changed && !ended)) return;
      lastCheckpoint = Date.now();
      changed = false;
      onCheckpoint(timeline.seconds, Number(instance.duration) || 0, ended);
    };
    const timeChanged = () => {
      const wasReady = timeline.initialized;
      initialized();
      if (!wasReady) return;
      const seconds = Number(instance.currentTime);
      if (!Number.isFinite(seconds)) return;
      const safeSeconds = Math.max(0, Math.floor(seconds));
      if (safeSeconds !== timeline.seconds) changed = true;
      timeline.seconds = safeSeconds;
      if (changed && Date.now() - lastCheckpoint >= 10_000) save();
    };
    const pause = () => { timeChanged(); save(); };
    const finish = () => { timeChanged(); save(true); };
    const hidden = () => { if (document.visibilityState === "hidden") pause(); };
    const failed = () => setError("O player encontrou um erro. Tente carregar a gravação novamente.");
    const handlers = [
      ["loadedmetadata", initialized], ["durationchange", initialized], ["timeupdate", timeChanged],
      ["pause", pause], ["ended", finish], ["seeked", timeChanged], ["error", failed],
    ] as const;
    for (const [name, callback] of handlers) instance.addEventListener(name, callback);
    initialized();
    window.addEventListener("pagehide", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      for (const [name, callback] of handlers) instance.removeEventListener(name, callback);
      window.removeEventListener("pagehide", pause);
      document.removeEventListener("visibilitychange", hidden);
      save();
      player.current = null;
      timeline.initialized = false;
    };
  }, [authorization, onCheckpoint]);

  return (
    <div className="video-frame">
      {authorization ? (
        <iframe
          key={authorization.url}
          ref={iframe}
          src={authorization.url}
          title={`Vídeo da aula ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
        />
      ) : null}
      {!authorization || error ? (
        <div className="video-placeholder">
          {error ? <>
            <p role="alert">{error}</p>
            <button type="button" className="button feature-button" onClick={() => {
              setError("");
              setAuthorization(null);
              setRequest((value) => value + 1);
            }}><RefreshCw size={17} aria-hidden="true" /> Tentar novamente</button>
          </> : <p className="cluster" role="status"><LoaderCircle className="logout-spinner" size={18} aria-hidden="true" /> Carregando gravação…</p>}
        </div>
      ) : null}
    </div>
  );
}
