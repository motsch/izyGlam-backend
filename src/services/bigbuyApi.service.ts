import axios, { AxiosInstance } from "axios";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * BigBuy: on centralise tout ici.
 * Mets exactement tes env:
 * - BIGBUY_BASE_URL (ex: https://api.bigbuy.eu)
 * - BIGBUY_TOKEN (token)
 */
class BigBuyApiService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = requireEnv("BIGBUY_BASE_URL");
    const apiKey = requireEnv("BIGBUY_TOKEN");

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  /**
   * POST /rest/shipping/orders.json
   * Renvoie les options de livraison (et donc les coûts shipping)
   */
  async getShippingOptions(payload: any) {
    const { data } = await this.client.post("/rest/shipping/orders.json", payload);
    return data;
  }

  /**
   * POST /rest/order/check.json
   * Vérifie/simule la commande et renvoie le total à payer (côté BigBuy)
   */
  async checkOrder(payload: any) {
    const { data } = await this.client.post("/rest/order/check.json", payload);
    return data;
  }

  /**
   * POST /rest/order/create.json
   * Crée la commande chez BigBuy
   */
  async createOrder(payload: any) {
    const { data } = await this.client.post("/rest/order/create.json", payload);
    return data;
  }
}

export const bigbuyApi = new BigBuyApiService();
