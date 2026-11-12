"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/action-state";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialActionState);
  const [email, setEmail] = useState(state.values?.email ?? "");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
  }, [emailInvalid, passwordInvalid, state]);

  return (
    <form action={action} className="form-grid login-form" noValidate aria-busy={pending} onSubmit={() => setPasswordVisible(false)}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <div className="login-field-control">
          <Mail className="login-field-icon" size={19} aria-hidden="true" />
          <input
            ref={emailRef}
            className="input"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={254}
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? "email-error" : undefined}
          />
        </div>
        {emailInvalid ? <p className="field-error" id="email-error">{state.fieldErrors?.email}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <div className="login-field-control login-password">
          <LockKeyhole className="login-field-icon" size={18} aria-hidden="true" />
          <input
            ref={passwordRef}
            className="input"
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-invalid={passwordInvalid || undefined}
            aria-describedby={passwordInvalid ? "password-error" : undefined}
          />
          <button
            className="login-password-toggle"
            type="button"
            aria-controls="password"
            aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {passwordInvalid ? <p className="field-error" id="password-error">{state.fieldErrors?.password}</p> : null}
      </div>
      {state.message ? (
        <p ref={alertRef} className="form-message" id="login-form-message" role="alert" tabIndex={-1}>
          {state.message}
        </p>
      ) : null}
      <button className="button login-submit" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
        <ArrowRight size={19} aria-hidden="true" />
      </button>
    </form>
  );
}
