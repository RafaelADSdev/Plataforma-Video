"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container page">
      <div className="empty-state">
        <h1>Não foi possível carregar esta tela</h1>
        <p className="muted">Tente novamente. Se o problema continuar, confira a conexão e a configuração do projeto.</p>
        <button className="button" type="button" onClick={() => reset()}>Tentar novamente</button>
      </div>
    </main>
  );
}
