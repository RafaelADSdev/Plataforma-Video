"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/action-state";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialActionState);
  const [email, setEmail] = useState(state.values?.email ?? "");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const emailInvalid = Boolean(state.fieldErrors?.email);
  const passwordInvalid = Boolean(state.fieldErrors?.password);

  useEffect(() => {
    if (emailInvalid) {
      emailRef.current?.focus();
      return;
    }
    if (passwordInvalid) {
      passwordRef.current?.focus();
      return;
    }
    if (state.message) {
      alertRef.current?.focus();
    }
  }, [emailInvalid, passwordInvalid, state.message]);

  return (
    <form action={action} className="form-grid" noValidate aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          ref={emailRef}
          className="input"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailInvalid || undefined}
          aria-describedby={emailInvalid ? "email-error" : undefined}
        />
        {emailInvalid ? <p className="field-error" id="email-error">{state.fieldErrors?.email}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          ref={passwordRef}
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordInvalid || undefined}
          aria-describedby={passwordInvalid ? "password-error" : undefined}
        />
        {passwordInvalid ? <p className="field-error" id="password-error">{state.fieldErrors?.password}</p> : null}
      </div>
      {state.message ? (
        <p ref={alertRef} className="form-message" id="login-form-message" role="alert" tabIndex={-1}>
          {state.message}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="field-hint" id="login-help">
        Não consegue entrar? Peça novas credenciais a quem administrou o seu acesso.
      </p>
    </form>
  );
}
