import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function Forbidden() {
  return (
    <main className="container page">
      <div className="empty-state" role="alert">
        <ShieldX aria-hidden="true" size={30} />
        <h1>Acesso negado</h1>
        <p>Seu papel não permite acessar esta página.</p>
        <Link className="button secondary" href="/">Voltar para o curso</Link>
      </div>
    </main>
  );
}
