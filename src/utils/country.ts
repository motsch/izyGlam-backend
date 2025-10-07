// utils/country.ts (ou en haut de chaque controller si tu préfères)
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Construit un filtre Mongo tolérant :
 * - match exact insensible à la casse sur la valeur passée
 * - si on te passe "FR", ça matchera "FR" (ou "fr")
 * - si on te passe "France", ça matchera "France" (ou "france")
 *
 * NB: si tu veux aussi mapper FR <-> France, dé-commente l'array "aliases".
 */
export const buildCountryQuery = (countryRaw: any) => {
  if (typeof countryRaw !== 'string' || !countryRaw.trim()) return undefined;

  const trimmed = countryRaw.trim();
  const rx = new RegExp(`^${escapeRegExp(trimmed)}$`, 'i');

  // Optionnel : map FR <-> France si tu veux couvrir les deux avec un seul param
  // const aliases = [trimmed];
  // if (/^fr$/i.test(trimmed)) aliases.push('France');
  // if (/^france$/i.test(trimmed)) aliases.push('FR');
  // return { country: { $in: aliases.map(a => new RegExp(`^${escapeRegExp(a)}$`, 'i')) } };

  return { country: rx };
};
