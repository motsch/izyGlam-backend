import UserModel from "../models/user";
import { releaseTwilioNumber } from "./twilioProvision.service"; // à créer côté Twilio

export async function deprovisionTwilioNumberForUser(userId: string) {
  const user: any = await UserModel.findById(userId);
  if (!user) return;

  const twilioNumber = user.twilioPhoneNumber;
  if (twilioNumber) {
    // libère côté Twilio (IncomingPhoneNumbers)
    await releaseTwilioNumber(twilioNumber);
  }

  user.twilioPhoneNumber = null;
  user.assistantProEnabled = false;
  user.assistantShopId = null;

  await user.save();
}
