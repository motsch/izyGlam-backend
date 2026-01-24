const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/bigbuyTaxonomyController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/admin/bigbuy/taxonomy/beauty", ctrl.getBeautyTaxonomy);

module.exports = router;
