import { Request } from "express";

export const SUPPORTED_LANGS = new Set([
  'ar','be','bn','ca','da','de','en','es','et','eu','fa','fi','fr','gl','hi','id',
  'it','ja','ko','ku','ms','nl','pl','pt','ro','ru','so','sq','sv','th','tl','tr',
  'uk','vi','zh'
]);

export function resolveLang(req: Request): string {
  const q = (req.query?.lang ?? req.headers["x-lang"] ?? "").toString().toLowerCase();
  const fromHeader = (req.headers["accept-language"] ?? "").toString().split(",")[0].toLowerCase();
  let lang = (q || fromHeader || "fr").slice(0, 2);
  if (!SUPPORTED_LANGS.has(lang)) lang = "fr";
  return lang;
}