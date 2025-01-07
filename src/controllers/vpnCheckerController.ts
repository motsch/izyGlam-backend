import * as express from "express";
import axios from "axios";
import validator from "validator";

// Récupérer tous les tips
export const getVPNInfos = async (req: express.Request, res: express.Response) => {
  
    const ip = req.params.ip;

    if (!validator.isIP(ip)) {
        return res.status(400).json({ error: "Adresse IP invalide." });
    }
  
    const API_KEY = process.env.PROXYCHECK_API_KEY;
    const url = `https://proxycheck.io/v2/${ip}?key=${API_KEY}&vpn=1`;
  
    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error:any) {
        console.error("Erreur lors de la requête à ProxyCheck:", error.message);
        res.status(500).json({ error: "Erreur lors de la vérification VPN." });
    }
};

export default {
    getVPNInfos,
};
