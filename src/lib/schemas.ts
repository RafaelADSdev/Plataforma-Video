import { z } from "zod";

// PostgreSQL accepts the canonical UUID text form independently of RFC version
// and variant bits. Database identifiers may therefore be valid in Postgres
// while being rejected by Zod's stricter z.uuid() validator.
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function postgresUuidSchema(message = "Identificador inválido.") {
  return z.string().regex(POSTGRES_UUID_PATTERN, message);
}
