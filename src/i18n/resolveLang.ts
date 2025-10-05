// src/i18n/resolveLang.ts
import type { SupportedLang } from "./email";
import type { Request } from "express";

// ⚠️ runtime whitelist (doit correspondre à SupportedLang)
const ALLOWED = new Set<SupportedLang>([
  "fi","sv","pl","da","fr","en","es","it","nl","de","pt",
  "ar","tr","zh","ru","fa","uk","ro","ca","eu","gl","sq",
  "ku","et","so","be","ja","ko","id","ms","th","vi","tl",
  "hi","bn"
]);

function toLang2(raw?: string | null): string {
  if (!raw) return "en";
  // ex: "fr-FR,fr;q=0.9" -> "fr"
  const first = raw.split(",")[0]?.trim() || raw;
  const code2 = first.slice(0, 2).toLowerCase();
  return code2 || "en";
}

function normalize(raw?: string | null): SupportedLang {
  const c = toLang2(raw) as SupportedLang;
  return (ALLOWED.has(c) ? c : "en") as SupportedLang;
}

/** Récupère la langue depuis query, body, ou Accept-Language. */
export function resolveLang(req: Request): SupportedLang {
  const q = (req.query?.lang as string | undefined) || undefined;
  const b = (req.body?.lang as string | undefined) || undefined;
  const h = (req.headers?.["accept-language"] as string | undefined) || undefined;

  // priorité: query > body > header
  return normalize(q || b || h || "en");
}
