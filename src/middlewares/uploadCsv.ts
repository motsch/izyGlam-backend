import multer from "multer";

const storage = multer.memoryStorage();

export const uploadCsv = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" || // souvent pour CSV…
      file.originalname.toLowerCase().endsWith(".csv");

    if (!ok) return cb(new Error("Fichier invalide. Upload un .csv"));
    cb(null, true);
  },
});
