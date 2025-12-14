import CompanyModel from "../models/company";
import UserModel from "../models/user";
import { logger } from "../utils/logger";

export async function runCompanyCreditsExpiryJob() {
  const now = new Date();

  const companies = await CompanyModel.find({
    abonnement_end: { $ne: null },
  }).lean();

  for (const c of companies) {
    if (!c.abonnement_end) continue;

    // déjà fait => skip
    if (c.creditsZeroedAt) continue;

    const end = new Date(c.abonnement_end);
    const graceDays = Number(c.graceDaysAfterEnd || 90);

    const deadline = new Date(end);
    deadline.setDate(deadline.getDate() + graceDays);

    if (now > deadline) {
      await UserModel.updateMany({ companyId: c._id.toString() }, { $set: { credit: 0 } });
      await CompanyModel.updateOne({ _id: c._id }, { $set: { creditsZeroedAt: new Date() } });

      logger.info({
        msg: "credits zeroed after grace",
        companyId: c._id.toString(),
        abonnement_end: c.abonnement_end,
        graceDays,
      });
    }
  }
}
