import { BrandMark } from "@/components/brand-mark";

export default function Loading() {
  return (
    <main className="container page" aria-busy="true" aria-live="polite">
      <div className="loading-block">
        <BrandMark />
        <p className="muted">Carregando conteúdo…</p>
      </div>
    </main>
  );
}
