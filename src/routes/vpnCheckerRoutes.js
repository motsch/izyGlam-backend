const express = require("express");
const router = express.Router();
const vpnCheckerController = require("../controllers/vpnCheckerController");

// Route pour récupérer tous les tips
router.get("/vpn-check/:ip", vpnCheckerController.getVPNInfos);


module.exports = router;
