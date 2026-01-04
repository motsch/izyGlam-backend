/**
 * Script: handleUpdate.ts
 * Objectif: ajouter / réparer le champ "handle" pour tous les shops qui n'en ont pas
 * Lancement: npx ts-node src/scripts/handleUpdate.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import ShopModel from "../models/shop";

// ======================
// CONFIG
// ======================
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/izyglam";

// ======================
// UTILS
// ======================
const normalizeHandle = (input: any): string => {
  const raw = String(input ?? "")
    .trim()
    .replace(/^@+/, "");

  if (!raw) return "";

  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const cleaned = noAccents
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");

  return cleaned.replace(/^[._]+|[._]+$/g, "");
};

const generateUniqueHandle = async (base: string): Promise<string> => {
  let candidate = normalizeHandle(base);
  if (!candidate) candidate = "shop";

  candidate = candidate.slice(0, 30);

  let i = 0;
  while (true) {
    const finalHandle = i === 0 ? candidate : `${candidate}${i + 1}`;

    const exists = await ShopModel.exists({ handle: finalHandle });
    if (!exists) return finalHandle;

    i++;
    if (i > 500) {
      throw new Error("Impossible de générer un handle unique (trop de collisions).");
    }
  }
};

// ======================
// SCRIPT
// ======================
async function run() {
  console.log("🚀 Migration handles started");
  console.log(`🔌 Mongo URI: ${MONGO_URI ? "OK" : "MISSING"}`);

  // 1️⃣ Connexion Mongo
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  // 2️⃣ Shops sans handle (absent, vide, null)
  const shops = await ShopModel.find(
    { $or: [{ handle: { $exists: false } }, { handle: "" }, { handle: null }] },
    { _id: 1, name: 1 } // on ne charge que le strict nécessaire
  ).lean();

  console.log(`🔎 Shops à mettre à jour: ${shops.length}`);

  let updated = 0;
  let failed = 0;

  // 3️⃣ Update ciblé (PAS de save() pour éviter les required manquants type filter)
  for (const shop of shops) {
    try {
      const base = (shop as any).name || "shop";
      const nextHandle = await generateUniqueHandle(base);

      await ShopModel.updateOne(
        { _id: shop._id },
        { $set: { handle: nextHandle } },
        {
          runValidators: false, // ✅ important : on ne veut pas revalider tout le doc en migration
        }
      );

      updated++;
      console.log(`✅ ${shop._id} -> ${nextHandle}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ Failed for shop ${shop._id}:`, err?.message || err);
      // on continue la boucle
    }
  }

  console.log("🎉 Migration terminée");
  console.log(`✅ Shops mis à jour : ${updated}`);
  console.log(`❌ Shops en erreur : ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed", err);
  process.exit(1);
});
