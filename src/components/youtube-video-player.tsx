"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { PlaybackCoverage, VideoCheckpoint, VideoControls } from "@/components/private-video-player";

type YouTubePlayer = {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
};

type YouTubeApi = {
  Player: new (iframe: HTMLIFrameElement, options: { events: {
    onReady(event: { target: YouTubePlayer }): void;
    onStateChange(event: { data: number }): void;
    onError(): void;
  } }) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeApi() {
  const browser = window as YouTubeWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;

    function fail() {
      clearTimeout(timeout);
      delete browser.onYouTubeIframeAPIReady;
      script.remove();
      apiPromise = undefined;
      reject(new Error("API do YouTube indisponível."));
    }

    const timeout = setTimeout(fail, 12_000);
    script.onerror = fail;
    browser.onYouTubeIframeAPIReady = () => {
      if (!browser.YT?.Player) return;
      clearTimeout(timeout);
      delete browser.onYouTubeIframeAPIReady;
      resolve(browser.YT);
    };
    document.head.append(script);
  });
  return apiPromise;
}

function currentSeconds(player: YouTubePlayer | null) {
  const seconds = player?.getCurrentTime();
  return typeof seconds === "number" && Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : null;
}

export function YouTubeVideoPlayer({ ref, videoId, title, startAt, trackCoverage, onCheckpoint }: {
  ref: Ref<VideoControls>;
  videoId: string;
  title: string;
  startAt: number;
  trackCoverage: boolean;
  onCheckpoint: VideoCheckpoint;
}) {
  const host = useRef<HTMLDivElement>(null);
  const readyPlayer = useRef<YouTubePlayer | null>(null);
  const initialSeconds = useRef(startAt);
  const [showLink, setShowLink] = useState(false);

  useImperativeHandle(ref, () => ({
    seek(seconds) { readyPlayer.current?.seekTo(seconds, true); },
    seconds() { return currentSeconds(readyPlayer.current); },
  }), []);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const source = new URL(`https://www.youtube.com/embed/${videoId}`);
    source.search = new URLSearchParams({
      enablejsapi: "1", origin: window.location.origin, playsinline: "1", rel: "0",
      start: String(initialSeconds.current),
    }).toString();
    // The IFrame API removes its iframe when the player is destroyed.
    const frame = document.createElement("iframe");
    frame.src = source.href;
    frame.title = `Vídeo da aula ${title}`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "origin";
    container.append(frame);

    let disposed = false;
    let player: YouTubePlayer | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let lastSaved = initialSeconds.current;
    let started = false;
    let playbackSample: { seconds: number; time: number } | undefined;
    let lastCheckpoint = 0;
    const ranges: PlaybackCoverage["ranges"] = [];

    function samplePlayback() {
      const activePlayer = readyPlayer.current;
      if (!trackCoverage || !activePlayer) return;
      const seconds = activePlayer.getCurrentTime();
      const time = performance.now();
      const previous = playbackSample;
      playbackSample = { seconds, time };
      if (!previous || !Number.isFinite(seconds)) return;

      const advance = seconds - previous.seconds;
      const elapsed = (time - previous.time) / 1000;
      if (!(advance > 0 && advance <= elapsed * activePlayer.getPlaybackRate() + 0.2)) return;
      const start_ms = Math.max(0, Math.floor(previous.seconds * 1000));
      const end_ms = Math.ceil(seconds * 1000);
      const last = ranges.at(-1);
      if (last && start_ms >= last.start_ms && start_ms <= last.end_ms) last.end_ms = Math.max(last.end_ms, end_ms);
      else ranges.push({ start_ms, end_ms });
      if (ranges.length > 256) ranges.shift();
    }

    function checkpoint(ended = false) {
      const seconds = currentSeconds(readyPlayer.current);
      if (!started || seconds === null || (seconds === lastSaved && !ended)) return;
      lastSaved = seconds;
      lastCheckpoint = performance.now();
      const duration = readyPlayer.current?.getDuration() || 0;
      const durationMs = Math.round(duration * 1000);
      const coverage = trackCoverage && durationMs > 0 && durationMs <= 86_400_000 ? {
        durationMs,
        ranges: ranges.filter(({ start_ms }) => start_ms < durationMs)
          .map(({ start_ms, end_ms }) => ({ start_ms, end_ms: Math.min(end_ms, durationMs) })),
      } : undefined;
      onCheckpoint(seconds, duration, ended, coverage);
    }

    const save = () => checkpoint();
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", saveWhenHidden);
    void loadYouTubeApi().then((api) => {
      if (disposed) return;
      player = new api.Player(frame, { events: {
        onReady(event) { if (!disposed) readyPlayer.current = event.target; },
        onStateChange({ data }) {
          if (disposed) return;
          clearInterval(interval);
          if (data === api.PlayerState.PLAYING) {
            started = true;
            lastCheckpoint = performance.now();
            playbackSample = undefined;
            samplePlayback();
            interval = trackCoverage ? setInterval(() => {
              samplePlayback();
              if (performance.now() - lastCheckpoint >= 10_000) save();
            }, 500) : setInterval(save, 10_000);
          } else {
            if (playbackSample) samplePlayback();
            playbackSample = undefined;
            if (data === api.PlayerState.PAUSED || data === api.PlayerState.ENDED) {
              checkpoint(data === api.PlayerState.ENDED);
            }
          }
        },
        onError() { if (!disposed) setShowLink(true); },
      } });
    }).catch(() => { if (!disposed) setShowLink(true); });

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      save();
      readyPlayer.current = null;
      player?.destroy();
      frame.remove();
    };
  }, [videoId, title, onCheckpoint, trackCoverage]);

  return (
    <>
      <div className="video-frame" ref={host} />
      {showLink ? <p className="player-note"><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">Abrir vídeo no YouTube</a></p> : null}
    </>
  );
}
