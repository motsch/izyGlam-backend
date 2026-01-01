import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import FakePostModel from "../models/fakePost";

// ======================
// CONFIG
// ======================
const MONGO_URI = process.env.MONGODB_URI  || "mongodb+srv://fmotsch:Fr%40ncis2018%21@cluster0.dzdgnj3.mongodb.net/devfreelance";
const FILE_PATH = path.resolve(__dirname, "data/post-templates.json");

// ======================
// UTILS
// ======================
const normalize = (v: any) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

const normalizePlatform = (v: any) => {
  const p = normalize(v);
  if (["instagram", "tiktok", "facebook"].includes(p)) return p;
  return "instagram";
};

// ======================
// SCRIPT
// ======================
async function run() {
  console.log("🚀 Import FakePosts started");

  // 1️⃣ Connexion Mongo
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  // 2️⃣ Lecture du fichier
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Fichier introuvable : ${FILE_PATH}`);
  }

  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const json = JSON.parse(raw);

  if (!Array.isArray(json.templates)) {
    throw new Error("Format invalide : templates[] manquant");
  }

  let inserted = 0;
  let skipped = 0;

  // 3️⃣ Import
  for (const tpl of json.templates) {
    const text = String(tpl.text ?? "").trim();
    if (!text) {
      skipped++;
      continue;
    }

    // ⚠️ Anti-duplication par contenu
    const exists = await FakePostModel.findOne({ text });
    if (exists) {
      skipped++;
      continue;
    }

    await FakePostModel.create({
      platform: normalizePlatform(tpl.platform),
      lang: "fr",
      shopTypes: Array.isArray(tpl.shopTypes) && tpl.shopTypes.length
        ? tpl.shopTypes.map(normalize)
        : ["all"],
      tone: tpl.tone,
      text,
      active: true,
    });

    inserted++;
  }

  console.log("🎉 Import terminé");
  console.log(`✅ Posts ajoutés : ${inserted}`);
  console.log(`⏭️ Posts ignorés (déjà existants ou invalides) : ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

// ======================
run().catch((err) => {
  console.error("❌ Import failed", err);
  process.exit(1);
});
