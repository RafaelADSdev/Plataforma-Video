"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, Film, LoaderCircle } from "lucide-react";
import type { Upload } from "tus-js-client";
import type { LessonVideoState, UploadState } from "@/lib/lesson-media";

type Summary = { videoStatus: LessonVideoState; uploadState: UploadState | null; originalUrl: string | null };
type StartResponse = Summary & { uploadUrl?: string; error?: string };

const statusText = {
  none: "Sem gravação",
  migration_required: "Gravação aguardando migração",
  uploading: "Envio em andamento",
  processing: "Processando vídeo",
  failed: "Envio ou processamento interrompido",
  ready: "Gravação pronta",
};

async function fingerprint(file: File) {
  const sampleSize = 128 * 1024;
  const sample = new Blob([
    `${file.size}:${file.name}:${file.lastModified}:`,
    file.slice(0, sampleSize),
    file.slice(Math.max(sampleSize, file.size - sampleSize)),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", await sample.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function LessonVideoUpload({
  lessonId, initialStatus, onStatus, uploadAvailable,
}: {
  lessonId: string;
  initialStatus: LessonVideoState;
  onStatus: (status: LessonVideoState) => void;
  uploadAvailable: boolean;
}) {
  const endpoint = `/api/lessons/${lessonId}/video`;
  const currentUpload = useRef<Upload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary>({
    videoStatus: initialStatus,
    uploadState: initialStatus === "uploading" || initialStatus === "processing" || initialStatus === "failed" ? initialStatus : null,
    originalUrl: null,
  });
  const [percentage, setPercentage] = useState(0);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const [epoch, setEpoch] = useState(0);
  const applyStatus = useCallback((status: Summary) => {
    setSummary({ videoStatus: status.videoStatus, uploadState: status.uploadState, originalUrl: status.originalUrl });
    onStatus(status.videoStatus);
  }, [onStatus]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("status");
        const status = await response.json() as Summary;
        if (controller.signal.aborted) return;
        applyStatus(status);
        if (uploadAvailable && (status.uploadState === "uploading" || status.uploadState === "processing")) timer = setTimeout(poll, 4500);
      } catch {
        if (!controller.signal.aborted && uploadAvailable && initialStatus !== "none") {
          timer = setTimeout(poll, 9000);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [endpoint, applyStatus, epoch, initialStatus, uploadAvailable]);

  useEffect(() => () => { void currentUpload.current?.abort(); }, []);

  async function start() {
    if (!file || sending || cancelling) return;
    if (!file.size || file.size > 30_000_000_000
      || (!file.type.startsWith("video/") && !/\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg)$/i.test(file.name))) {
      setMessage("Escolha um arquivo de vídeo de até 30 GB.");
      return;
    }
    setMessage("");
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: file.size, fingerprint: await fingerprint(file) }),
      });
      const result = await response.json() as StartResponse;
      if (!response.ok || !result.uploadUrl) {
        setMessage(result.error ?? "Não foi possível iniciar o envio.");
        setEpoch((value) => value + 1);
        setSending(false);
        return;
      }
      applyStatus(result);
      const { Upload } = await import("tus-js-client");
      const upload = new Upload(file, {
        uploadUrl: result.uploadUrl,
        chunkSize: 10 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        storeFingerprintForResuming: false,
        onProgress(sent, total) {
          setPercentage(Math.min(100, Math.round(sent / total * 100)));
        },
        onError() {
          if (currentUpload.current !== upload) return;
          currentUpload.current = null;
          setSending(false);
          setMessage("Envio interrompido. Selecione o mesmo arquivo para retomar.");
          setEpoch((value) => value + 1);
        },
        onSuccess() {
          if (currentUpload.current !== upload) return;
          currentUpload.current = null;
          setSending(false);
          setFile(null);
          applyStatus({
            videoStatus: result.videoStatus === "ready" ? "ready" : "processing",
            uploadState: "processing",
            originalUrl: result.originalUrl,
          });
          setEpoch((value) => value + 1);
        },
      });
      currentUpload.current = upload;
      upload.start();
    } catch {
      setSending(false);
      setMessage("Não foi possível enviar a gravação. Tente novamente.");
    }
  }

  async function cancel() {
    setCancelling(true);
    setMessage("");
    try {
      await currentUpload.current?.abort();
      currentUpload.current = null;
      setSending(false);
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error("cancel");
      applyStatus(await response.json() as Summary);
      setPercentage(0);
      setEpoch((value) => value + 1);
    } catch {
      setMessage("Não foi possível cancelar o envio. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  }

  const currentStatus = summary.uploadState ?? summary.videoStatus;
  const originalRecording = summary.originalUrl ? <p className="muted">
    <a href={summary.originalUrl} target="_blank" rel="noreferrer">Gravação original no YouTube</a>
  </p> : null;
  if (!uploadAvailable) return originalRecording;

  return (
    <div className="video-upload">
      <div className="cluster" role="status">
        <Film size={20} aria-hidden="true" />
        <strong>{statusText[currentStatus]}</strong>
        {summary.videoStatus === "ready" && summary.uploadState ? <span className="badge success">Gravação anterior disponível</span> : null}
      </div>
      {summary.videoStatus === "migration_required" ? <p className="muted">Envie o arquivo original da aula para disponibilizar a gravação privada.</p> : null}
      {originalRecording}
      {summary.uploadState === "processing" ? <p className="muted">O vídeo aparecerá aqui quando terminar de processar. Você pode voltar a esta página depois.</p> : (
        <div className="field">
          <label htmlFor="lesson-video">{summary.videoStatus === "ready" ? "Escolher vídeo substituto" : "Arquivo de vídeo"}</label>
          <input className="input" id="lesson-video" type="file" accept="video/*,.mp4,.m4v,.mov,.webm,.mkv" disabled={sending || cancelling} onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPercentage(0);
          }} />
          {summary.uploadState === "uploading" && !sending ? <p className="field-hint">Selecione o mesmo arquivo para continuar do ponto em que parou.</p> : null}
        </div>
      )}
      {sending ? <div className="upload-progress"><progress aria-label="Envio do vídeo" value={percentage} max={100} /><span>{percentage}%</span></div> : null}
      <div className="cluster">
        {summary.uploadState !== "processing" ? (
          <button className="button secondary" type="button" disabled={!file || sending || cancelling} onClick={() => void start()}>
            {sending ? <LoaderCircle size={17} className="logout-spinner" aria-hidden="true" /> : <CloudUpload size={17} aria-hidden="true" />}
            {sending ? "Enviando…" : summary.uploadState === "uploading" ? "Retomar envio" : "Enviar vídeo"}
          </button>
        ) : null}
        {summary.uploadState ? <button className="button ghost" type="button" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? "Cancelando…" : "Cancelar envio"}</button> : null}
      </div>
      {message ? <p className="form-message" role="alert">{message}</p> : null}
    </div>
  );
}
