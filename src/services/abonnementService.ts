import UserModel from "../models/user";

async function checkAbonnements() {
  const now = new Date();

  console.log("Checking abonnements...");

  try {
    // Trouver les utilisateurs avec un abonnement expiré
    const expiredUsers = await UserModel.find({
      abonnement: { $ne: "free" }, // Exclure les utilisateurs déjà sur le plan gratuit
      abonnement_end: { $lt: now }, // Date d'expiration passée
    });

    if (expiredUsers.length === 0) {
      console.log("No expired abonnements found.");
      return;
    }

    // Mettre à jour les utilisateurs expirés pour revenir au plan gratuit
    for (const user of expiredUsers) {
      user.abonnement = "free";
      user.abonnement_end = null; // Pas de date de fin pour le plan gratuit
      await user.save();
      console.log(`User ${user.email} reverted to free plan.`);
    }

    console.log(`${expiredUsers.length} users reverted to free plan.`);
  } catch (error) {
    console.error("Error while checking abonnements:", error);
  }
}

export { checkAbonnements };
