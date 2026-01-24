import * as express from "express";
import { logger } from "../utils/logger";
import { findBeautyTaxonomyId } from "../services/bigbuyTaxonomyService";

const getBeautyTaxonomy = async (req: express.Request, res: express.Response) => {
  try {
    const result = await findBeautyTaxonomyId();
    logger.info({ msg: "getBeautyTaxonomy success", result });
    res.json(result);
  } catch (error: any) {
    logger.error({ msg: "getBeautyTaxonomy failed", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer la taxonomie Beauté" });
  }
};

module.exports = { getBeautyTaxonomy };
