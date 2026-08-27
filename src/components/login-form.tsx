"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/action-state";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialActionState);

  return (
    <form action={action} className="form-grid" noValidate>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? <p className="field-error" id="email-error">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        {state.fieldErrors?.password ? <p className="field-error" id="password-error">{state.fieldErrors.password}</p> : null}
      </div>
      {state.message ? <p className="form-message" role="alert">{state.message}</p> : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
