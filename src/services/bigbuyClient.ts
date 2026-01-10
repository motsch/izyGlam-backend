import axios from "axios";

const baseURL = process.env.BIGBUY_BASE_URL || "https://api.bigbuy.eu";
const token = process.env.BIGBUY_TOKEN;
const format = process.env.BIGBUY_FORMAT || "json";

if (!token) {
  // ⚠️ On ne throw pas au build, mais en runtime ça doit être présent.
  // Tu peux choisir de throw ici si tu veux bloquer le démarrage.
}

export const bigbuyHttp = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

export function bb(path: string) {
  // helper: ajoute format si besoin
  // ex: bb("/rest/catalog/products") => "/rest/catalog/products.json"
  return `${path}.${format}`;
}
