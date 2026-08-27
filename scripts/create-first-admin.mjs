import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const adminKey = (
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
)?.trim();

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
}

function requireServerEnvironment() {
  const missing = [];

  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!adminKey) missing.push("SUPABASE_SECRET_KEY");

  if (missing.length > 0) {
    throw new Error(
      `defina ${missing.join(" e ")} no ambiente antes de executar o script.`,
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL não é uma URL válida.");
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error("SUPABASE_URL deve usar http ou https.");
  }

  if (
    adminKey.startsWith("sb_publishable_") ||
    adminKey.toLowerCase().includes("substitua")
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY não pode receber a publishable key nem o placeholder do .env.example.",
    );
  }
}

async function readVisibleValue(label) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "sem terminal interativo; defina FIRST_ADMIN_EMAIL e FIRST_ADMIN_PASSWORD no ambiente.",
    );
  }

  const readline = createInterface({ input, output });

  try {
    return (await readline.question(label)).trim();
  } finally {
    readline.close();
  }
}

async function readSecret(label) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error(
      "não foi possível ocultar a senha neste terminal; defina FIRST_ADMIN_PASSWORD no ambiente.",
    );
  }

  output.write(label);
  input.setEncoding("utf8");
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let secret = "";

    const restoreTerminal = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          restoreTerminal();
          reject(new Error("operação cancelada."));
          return;
        }

        if (character === "\r" || character === "\n") {
          restoreTerminal();
          resolve(secret);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          secret = secret.slice(0, -1);
          continue;
        }

        if (character >= " ") secret += character;
      }
    };

    input.on("data", onData);
  });
}

async function getCredentials() {
  const email =
    process.env.FIRST_ADMIN_EMAIL?.trim() ||
    (await readVisibleValue("E-mail do primeiro admin: "));
  const password =
    process.env.FIRST_ADMIN_PASSWORD ||
    (await readSecret("Senha inicial (não será exibida): "));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("informe um e-mail válido para o primeiro admin.");
  }

  if (password.length < 8) {
    throw new Error("a senha inicial deve ter pelo menos 8 caracteres.");
  }

  return { email, password };
}

async function main() {
  requireServerEnvironment();

  const { email, password } = await getCredentials();
  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });

  if (error) {
    const details = [error.code, error.message].filter(Boolean).join(": ");
    throw new Error(`o Supabase recusou a criação do usuário${details ? ` (${details})` : ""}.`);
  }

  if (!data.user) {
    throw new Error("o Supabase não retornou o usuário criado.");
  }

  console.log("Primeiro administrador criado com sucesso.");
  console.log(`ID: ${data.user.id}`);
  console.log(`E-mail: ${data.user.email}`);
  console.log("Papel: admin (app_metadata)");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "falha inesperada.");
});
