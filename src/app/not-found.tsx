import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container page">
      <div className="empty-state">
        <h1>Conteúdo não encontrado</h1>
        <p className="muted">Este item não existe ou não está disponível para a sua conta.</p>
        <Link className="button" href="/">Voltar ao curso</Link>
      </div>
    </main>
  );
}
