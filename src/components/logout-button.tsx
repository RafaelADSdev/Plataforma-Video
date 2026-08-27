"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";

function LogoutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      className="icon-button"
      type="submit"
      aria-label="Sair da conta"
      title={pending ? "Saindo…" : "Sair"}
      disabled={pending}
    >
      {pending
        ? <LoaderCircle className="logout-spinner" aria-hidden="true" size={18} />
        : <LogOut aria-hidden="true" size={18} />}
      <span className="sr-only" aria-live="polite">{pending ? "Saindo da conta…" : ""}</span>
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <LogoutSubmit />
    </form>
  );
}
