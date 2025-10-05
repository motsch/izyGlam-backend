import * as express from "express";
import axios from "axios";
import validator from "validator";
import { logger } from "../utils/logger";

// Récupérer tous les tips
export const getVPNInfos = async (req: express.Request, res: express.Response) => {
  const ip = req.params.ip;

  // Log d'entrée
  logger.info({
    msg: "vpnCheck.start",
    ip,
    route: req.originalUrl,
    method: req.method,
    userAgent: req.headers["user-agent"],
  });

  if (!validator.isIP(ip)) {
    logger.warn({
      msg: "vpnCheck.invalidIp",
      ip,
      route: req.originalUrl,
      method: req.method,
    });
    return res.status(400).json({ error: "Adresse IP invalide." });
  }

  const API_KEY = process.env.PROXYCHECK_API_KEY;
  const url = `https://proxycheck.io/v2/${ip}?key=${API_KEY}&vpn=1`;

  try {
    logger.info({
      msg: "vpnCheck.request.proxycheck",
      ip,
      target: "proxycheck.io",
      url,
    });

    const response = await axios.get(url);

    logger.info({
      msg: "vpnCheck.success",
      ip,
      status: response.status,
      hasData: !!response.data,
    });

    res.json(response.data);
  } catch (error: any) {
    logger.error({
      msg: "vpnCheck.error",
      ip,
      route: req.originalUrl,
      method: req.method,
      errorMessage: error?.message,
      status: error?.response?.status,
    });
    res.status(500).json({ error: "Erreur lors de la vérification VPN." });
  }
};

export default {
  getVPNInfos,
};
