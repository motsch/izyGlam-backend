import UserModel from "../models/user";
import fs from "fs";
import * as express from "express";
import axios from 'axios';
import path from "path"; // Pour manipuler les chemins locaux
import { renderEmailHTML } from "../i18n/email";
import { resolveLang } from "../i18n/resolveLang";
import { logger } from "../utils/logger";
import { randomBytes } from "node:crypto";
import { makeTransport } from "../utils/mailer";
import CompanyModel from "../models/company";
import bookingModel from "../models/booking";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://izyglam.com";

// import
require("dotenv").config();
// controllers/usersController.js
const jwt = require("jsonwebtoken");
require("dotenv").config();
const twilio = require("twilio");
const client = new twilio(
  "ACdf6e48d68c448eb4e9105f784f2fcd88",
  "158c48da620e1e262a3229eed40fc517"
);

const getUserInfo = async (
  req: { header: (arg0: string) => any },
  res: {
    status: (arg0: number) => {
      (): any;
      new(): any;
      json: { (arg0: { message?: string; error?: string }): void; new(): any };
    };
    json: (arg0: {
      companyId: string;
      lastname: string;
      email: string;
      twilioPhoneNumber: string;
      assistantShopId: string;
      assistantProEnabled: boolean;
      firstname: string;
      role: string;
      phone: string;
      conversationId: string;
      sex: string;
      subscription: any;
      bank: any;
      customerId: string;
      address: any[];
      proches: any[];
      favoriteShops: any[];
      fidelity: any;
      abonnement: string;
<<<<<<< HEAD
=======
      country: string;
      _id: string;
      lastSeen?: string; // ✅ pour exposer lastSeen si tu veux
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
    }) => void;
  }
) => {
  try {
    logger.info({ msg: "user.getInfo.start" });

    type UserInfo = {
      companyId: string;
      lastname: string;
      email: string;
      firstname: string;
      twilioPhoneNumber: string;
      assistantShopId: string;
      assistantProEnabled: boolean;
      role: string;
      phone: string;
      conversationId: string;
      sex: string;
      customerId: string;
      abonnement: string;
      address: any[];
      proches: any[];
      subscription: any;
      bank: any;
      favoriteShops: any[];
      fidelity: any;
      _id: string;
      lastSeen?: string; // ✅
    };

    const rawAuth = req.header("Authorization");
    if (!rawAuth) {
      logger.warn({ msg: "user.getInfo.missingToken" });
      return res.status(401).json({ message: "Token d'authentification manquant" });
    }

    // ✅ Support "Bearer x.y.z" ou token brut
    const token = rawAuth.startsWith("Bearer ") ? rawAuth.slice(7) : rawAuth;

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any }) => {
        if (err) {
          logger.warn({ msg: "user.getInfo.invalidToken" });
          return res.status(403).json({ message: "Token d'authentification invalide" });
        }

        const userId = decodedToken.userId;
        const user = await UserModel.findById(userId);

        if (user) {
          if (!user.active) {
            logger.warn({ msg: "user.getInfo.notActivated", userId });
            return res.status(403).json({
              message: "Votre compte n’est pas encore activé. Veuillez vérifier vos emails."
            });
          }

          // ✅ Met à jour lastSeen (et updatedAt) AVANT de répondre
          try {
            const nowIso = new Date().toISOString();
            user.lastSeen = nowIso;
            user.updatedAt = nowIso; // utile vu que tu n'as pas { timestamps:true }
            await user.save();
          } catch (saveErr: any) {
            // On log juste : ne bloque pas la réponse utilisateur
            logger.error({
              msg: "user.getInfo.lastSeenUpdateFailed",
              errorMessage: saveErr?.message,
            });
          }

          const {
            lastname,
            email,
            firstname,
            role,
            twilioPhoneNumber,
            assistantShopId,
            address,
            assistantProEnabled,
            proches,
            phone,
            sex,
            customerId,
            bank,
            companyId,
            _id,
            favoriteShops,
            subscription,
            fidelity,
            abonnement,
            conversationId,
<<<<<<< HEAD
=======
            country,
            lastSeen, // ✅ on le renvoie si besoin
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
          } = user;

          logger.info({ msg: "user.getInfo.success", userId: _id?.toString() });
          res.json({
            lastname,
            email,
            firstname,
            role,
            twilioPhoneNumber,
            assistantShopId,
            assistantProEnabled,
            address,
            proches,
            phone,
            conversationId,
            sex,
            subscription,
            bank,
            abonnement,
            customerId,
            companyId,
            favoriteShops,
            fidelity,
            _id,
            lastSeen, // ✅
          } as UserInfo);
        } else {
          logger.warn({ msg: "user.getInfo.notFound", userId });
          res.status(404).json({ message: "User non trouvé" });
        }
      }
    );
  } catch (error: any) {
    logger.error({ msg: "user.getInfo.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Error:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des informations du user",
    });
  }
};


const refreshToken = async (
  req: { userId: any },
  res: {
    json: (arg0: { message: string; token: any }) => void;
    status: (arg0: number) => {
      (): any;
      new(): any;
      json: { (arg0: { message: string }): void; new(): any };
    };
  }
) => {
  try {
    logger.info({ msg: "auth.refreshToken.start", userId: req.userId });
    const userId = req.userId;

    const token = jwt.sign({ userId }, process.env.SECRET_KEY, {
      expiresIn: "72h",
    });

    logger.info({ msg: "auth.refreshToken.success", userId });
    res.json({ message: "Token rafraîchi avec succès", token });
  } catch (error: any) {
    logger.error({ msg: "auth.refreshToken.error", errorMessage: error?.message, stack: error?.stack });
    res
      .status(500)
      .json({ message: "Erreur lors du rafraîchissement du token" });
  }
};

const registerUserNoToken = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    logger.info({ msg: "user.registerNoToken.start" });
    const myUser = req.body;
    if (
      myUser.email !== "admin@developpeurfreelance.com" ||
      myUser.lastname !== "Admin" ||
      myUser.firstname !== "DeveloppeurFreelance" ||
      myUser.role !== "DeveloppeurFreelance"
    ) {
      logger.warn({ msg: "user.registerNoToken.unauthorizedAttempt" });
      return res
        .status(401)
        .json({ message: "Une erreur s'est produite. Veuillez recommencer !" });
    }
    const existingUser = await UserModel.findOne(myUser.email);
    if (existingUser) {
      logger.warn({ msg: "user.registerNoToken.emailExists", email: myUser.email });
      return res.status(409).json({
        message: "Cet email est déjà utilisé par un autre utilisateur",
      });
    }
    const newUser = new UserModel(myUser);
    await newUser.save();
    logger.info({ msg: "user.registerNoToken.success", id: newUser._id?.toString() });
    res.status(201).json(newUser);
  } catch (error: any) {
    logger.error({ msg: "user.registerNoToken.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({
      message: "Impossible de créer l'utilisateur => " + JSON.stringify(error),
    });
  }
};

const loginVerifSMS = async (
  req: { body: { sid: any; code: any; connectKey: any } },
  res: express.Response
) => {
  try {
    const { sid, code, connectKey } = req.body;
    logger.info({ msg: "auth.loginSMS.verify.start", sid });
    client.verify
      .services(sid)
      .verificationChecks.create({ code, to: sid })
      .then(async (verification_check: any) => {
        if (verification_check.status === "approved") {
          let user: any = null;
          if (connectKey.phone) {
            let phone = connectKey.phone;
            user = await UserModel.findOne({ phone });
          }
          if (!user) {
            logger.warn({ msg: "auth.loginSMS.verify.userNotFound", sid });
            return res.status(401).json({ message: "Not found" });
          }
          const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.SECRET_KEY,
            { expiresIn: "60h" }
          );
          logger.info({ msg: "auth.loginSMS.verify.success", userId: user._id?.toString() });
          res.json({ message: sid + " : Connexion réussie", token });
        } else {
          logger.warn({ msg: "auth.loginSMS.verify.invalidCode", sid });
          res.status(401).json({ message: "Code de vérification invalide" });
        }
      })
      .catch((error: any) => {
        logger.error({ msg: "auth.loginSMS.verify.error", sid, errorMessage: error?.message, stack: error?.stack });
        console.error(error);
        res.status(500).send("Failed to verify code");
      });
  } catch (error: any) {
    logger.error({ msg: "auth.loginSMS.verify.catch", errorMessage: error?.message, stack: error?.stack });
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la connexion" });
  }
};

const loginUserSMS = async (
  req: { body: { email: any; phone: any } },
  res: express.Response
) => {
  try {
    logger.info({ msg: "auth.loginSMS.start" });
    const { email, phone } = req.body;
    let user: any = null;
    if (email) {
      user = await UserModel.findOne({ email });
    } else if (phone) {
      user = await UserModel.findOne({ phone });
    }
    if (!user) {
      logger.warn({ msg: "auth.loginSMS.userNotFound", email, phone });
      return res.status(401).json({ message: "Not found" });
    }
    const code = Math.floor(100000 + Math.random() * 900000);

    client.messages
      .create({
        body: `Votre code de vérification est ${code}`,
        to: user.phone,
        from: "+14152372836",
      })
      .then((message: any) => {
        logger.info({ msg: "auth.loginSMS.smsSent", sid: message.sid, userId: user._id?.toString() });
        let connectKey = { sid: message.sid, identifiant: user.phone };
        res.json({ message: user._id + " : Connexion en cours", connectKey });
      })
      .catch((error: any) => {
        logger.error({ msg: "auth.loginSMS.smsError", errorMessage: error?.message, stack: error?.stack });
        console.error(error);
        res.status(500).send("Failed to send SMS");
      });
  } catch (error: any) {
    logger.error({ msg: "auth.loginSMS.error", errorMessage: error?.message, stack: error?.stack });
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la connexion" });
  }
};

const loginUser = async (
  req: { body: { email?: string; password?: string } },
  res: express.Response
) => {
  try {
    logger.info({ msg: "auth.login.start" });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      logger.warn({ msg: "auth.login.missingFields" });
      return res.status(400).json({ message: "Email et mot de passe requis." });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      logger.warn({ msg: "auth.login.userNotFound", email });
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn({ msg: "auth.login.badPassword", userId: user._id?.toString() });
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    if (!user.active) {
      logger.warn({ msg: "auth.login.notActivated", userId: user._id?.toString() });
      return res.status(403).json({
        message: "Votre compte n’est pas encore activé. Veuillez vérifier vos emails.",
        activationRequired: true
      });
    }

    if (!process.env.SECRET_KEY) {
      logger.error({ msg: "auth.login.missingSecret" });
      return res.status(500).json({ message: "Configuration serveur invalide." });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "72h" }
    );

    logger.info({ msg: "auth.login.success", userId: user._id?.toString() });
    return res.json({ message: "Connexion réussie", token });
  } catch (error: any) {
    logger.error({ msg: "auth.login.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Erreur login:", error);
    return res.status(500).json({ message: "Une erreur est survenue lors de la connexion." });
  }
};

/* --------------------------
   Forgot password
--------------------------- */
export const forgotPassword = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "auth.forgotPassword.start", email: req.body?.email });
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Email requis" });

    const lang = resolveLang(req);

    const user = await UserModel.findOne({ email });
    if (!user) {
      logger.warn({ msg: "auth.forgotPassword.userNotFound", email });
      return res.status(404).json({ message: "User not found" });
    }

    const token = randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
    const { subject, html } = renderEmailHTML("reset", lang, resetLink, new Date().getFullYear());

    const transporter = makeTransport();
    const logoPath = path.join(__dirname, "../../uploads/images/logo/logo.png");

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `IzyGlam <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
      attachments: [{ filename: "logo.png", path: logoPath, cid: "logo" }],
    });

    logger.info({ msg: "auth.forgotPassword.mailSent", messageId: info?.messageId, email });
    res.status(200).json({ message: `Password reset email sent to ${email}` });
  } catch (error: any) {
    logger.error({ msg: "auth.forgotPassword.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Error sending reset email:", error);
    res.status(500).json({ message: "Error sending reset email", error });
  }
};

export const resetPassword = async (req: express.Request, res: express.Response) => {
  const { token, newPassword } = req.body;
  try {
    logger.info({ msg: "auth.resetPassword.start" });
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      logger.warn({ msg: "auth.resetPassword.invalidToken" });
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.info({ msg: "auth.resetPassword.success", userId: user._id?.toString() });
    res.status(200).json({ message: "Password successfully reset" });
  } catch (error: any) {
    logger.error({ msg: "auth.resetPassword.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Error resetting password", error });
  }
};

<<<<<<< HEAD
=======
/**
 * PUT /users-country-update/:id
 * Body: { country: string }
 */
export const updateUserCountryById = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.params.id?.trim();
    const { country } = (req.body || {}) as { country?: string };

    if (!userId) {
      return res.status(400).json({ message: 'User ID manquant dans l’URL.' });
    }
    if (!country || typeof country !== 'string' || !country.trim()) {
      return res.status(400).json({ message: 'Paramètre "country" invalide.' });
    }

    // 1) Récupère le user par son ID
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // 2) Met à jour le champ
    user.country = country.trim();

    // 3) Sauvegarde
    await user.save();

    // 4) Nettoie la réponse (pas de champs sensibles)
    const { password, resetPasswordToken, resetPasswordExpires, emailVerificationToken, emailVerificationExpires, ...safeUser } =
      user.toObject();

    return res.json({
      message: 'Country mis à jour avec succès.',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Erreur updateUserCountryById:', err);
    return res.status(500).json({ message: 'Erreur serveur.', error: err?.message });
  }
};

>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
/* --------------------------
   Create user (send verify)
   - création "classique" web
   - ne touche pas aux guests créés via Twilio
--------------------------- */
export const createUser = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "user.create.start" });

    const payload = { ...req.body };
    const lang = resolveLang(req);

    // ✅ ne jamais faire confiance au client
    delete (payload as any).active;
    delete (payload as any).role;
    delete (payload as any).emailVerificationToken;
    delete (payload as any).emailVerificationExpires;
    delete (payload as any).customerId; // si tu veux éviter injection
    delete (payload as any).subscription; // idem
    delete (payload as any).stripe; // idem

    const email = String(payload.email || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();

    if (!email) return res.status(400).json({ message: "Email manquant." });
    if (!phone) return res.status(400).json({ message: "Téléphone manquant." });

    // ✅ email unique
    const emailExists = await UserModel.findOne({ email }).select({ _id: 1, role: 1 }).lean();
    if (emailExists) {
      return res.status(409).json({ message: "Cet email est déjà utilisé." });
    }

    // ✅ phone unique (si tu as mis unique index sur phone)
    const phoneExists: any = await UserModel.findOne({ phone }).select({ _id: 1, role: 1 }).lean();
    if (phoneExists) {
      if (phoneExists.role === "guest") {
        // 🔒 IMPORTANT : on ne "convertit" PAS automatiquement un guest en user ici
        // (sinon prise de contrôle du guest possible)
        return res.status(409).json({
          message:
            "Un compte invité existe déjà avec ce numéro. Veuillez vous connecter ou finaliser la conversion via un parcours dédié.",
          code: "GUEST_PHONE_EXISTS",
        });
      }

      return res.status(409).json({ message: "Ce numéro est déjà utilisé." });
    }

    // ✅ rôle forcé : création web => user
    const newUser = new UserModel({
      ...payload,
      email,
      phone,
      role: "user",
      active: false, // inactif tant que non vérifié
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      lastSeen: new Date().toString(),
    });

    // token vérif valable 1h
    const token = randomBytes(32).toString("hex");
    newUser.emailVerificationToken = token;
    newUser.emailVerificationExpires = new Date(Date.now() + 3600000);

    await newUser.save();

    // lien d’activation
    const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;

    const { subject, html } = renderEmailHTML("verify", lang, verifyLink, new Date().getFullYear());

    const transporter = makeTransport();

    const logoPath = path.join(__dirname, "../../uploads/images/logo/logo.png");
    const attachments: Array<{ filename: string; path: string; cid: string }> = [];

    if (fs.existsSync(logoPath)) {
      attachments.push({ filename: "logo.png", path: logoPath, cid: "logo" });
    } else {
      logger.warn({ msg: "email.logo.missing", triedPath: logoPath });
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `IzyGlam <${process.env.SMTP_USER}>`,
      to: newUser.email,
      subject,
      html,
      attachments,
    });

    const safeUser = newUser.toObject();
    delete (safeUser as any).password;
    delete (safeUser as any).emailVerificationToken;
    delete (safeUser as any).emailVerificationExpires;

    logger.info({ msg: "user.create.success", userId: newUser._id?.toString() });
    return res.status(201).json(safeUser);
  } catch (error: any) {
    logger.error({
      msg: "user.create.error",
      errorMessage: error?.message,
      stack: error?.stack,
    });

    // bonus : gestion unique index propre
    if (error?.code === 11000) {
      const key = Object.keys(error?.keyPattern || {})[0] || "field";
      return res.status(409).json({ message: `Conflit d'unicité sur ${key}.` });
    }

    return res.status(500).json({
      message: "Impossible de créer l'utilisateur",
      error: error?.message || error,
    });
  }
};


export const resendVerificationEmail = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "auth.resendVerification.start", email: req.body?.email });
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Email requis" });

    const lang = resolveLang(req);

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    if (user.active) {
      logger.info({ msg: "auth.resendVerification.alreadyActive", userId: user._id?.toString() });
      return res.status(200).json({ message: "Compte déjà activé" });
    }

    const token = randomBytes(32).toString("hex");
    user.emailVerificationToken = token;
    user.emailVerificationExpires = new Date(Date.now() + 3600000);
    await user.save();

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;
    const { subject, html } = renderEmailHTML("verify", lang, verifyLink, new Date().getFullYear());

    const transporter = makeTransport();
    const logoPath = path.join(__dirname, "../../uploads/images/logo/logo.png");

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `IzyGlam <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
      attachments: [{ filename: "logo.png", path: logoPath, cid: "logo" }],
    });

    logger.info({ msg: "auth.resendVerification.success", email });
    res.status(200).json({ message: "Email d'activation renvoyé" });
  } catch (error: any) {
    logger.error({ msg: "auth.resendVerification.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Erreur renvoi email activation:", error);
    res.status(500).json({ message: "Erreur lors du renvoi de l'email d'activation" });
  }
};

export const verifyEmail = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "auth.verifyEmail.start", tokenPresent: !!(req.query as any)?.token });
    const { token } = req.query as { token?: string };

    if (!token) {
      logger.warn({ msg: "auth.verifyEmail.missingToken" });
      return res.status(400).json({ message: "Token manquant" });
    }

    const user = await UserModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      logger.warn({ msg: "auth.verifyEmail.invalidOrExpired" });
      return res.status(400).json({ message: "Lien invalide ou expiré" });
    }

    user.active = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info({ msg: "auth.verifyEmail.success", userId: user._id?.toString() });
    return res.status(200).json({ message: "Compte activé avec succès" });
  } catch (error: any) {
    logger.error({ msg: "auth.verifyEmail.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Erreur vérification email:", error);
    res.status(500).json({ message: "Erreur serveur lors de la vérification" });
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const geolocation = async (req: any, res: any) => {
  const userIP = getUserIP(req);
  logger.info({ msg: "geo.lookup.start", userIP });

  if (userIP === '8.8.8.8') {
    logger.info({ msg: "geo.lookup.localFallback" });
    res.json({ city: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 });
    return;
  }

  try {
    const response = await axios.get(`https://ipapi.co/${userIP}/json/`);
    logger.info({ msg: "geo.lookup.success", userIP });
    res.json(response.data);
  } catch (error: any) {
    logger.error({ msg: "geo.lookup.error", userIP, errorMessage: error?.message });
    console.error('Erreur lors de la récupération de la localisation :', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération de la localisation.' });
  }
};

const getUserIP = (req: any) => {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8';
  return Array.isArray(ip) ? ip[0] : ip;
};

const getAllUsers = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "user.list.start" });
    const users = await UserModel.find();
    logger.info({ msg: "user.list.success", count: users.length });
    res.json(users);
  } catch (error: any) {
    logger.error({ msg: "user.list.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer les utilisateurs" });
  }
};

const getAllByAdminOptions = async (req: any, res: express.Response) => {
  try {
    const { pays, type } = req.body;
    logger.info({ msg: "admin.user.listByOptions.start", pays, type });
    const users = await UserModel.find({ role: type });
    logger.info({ msg: "admin.user.listByOptions.success", count: users.length });
    res.json(users);
  } catch (error: any) {
    logger.error({ msg: "admin.user.listByOptions.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer les utilisateurs" });
  }
};


/**
 * POST /users/:id/reset-company-password
 * Réinitialise le mot de passe d'un employé avec le mot de passe par défaut
 * défini sur l'entreprise (company.defaultPassword).
 *
 * Accès : admin / entreprise / boss
 */
const resetEmployeePasswordFromCompany = async (
  req: any,
  res: express.Response
) => {
  try {
    const employeeId = (req.params.id || "").trim();
    logger.info({ msg: "user.resetCompanyPassword.start", employeeId });

    if (!employeeId) {
      return res.status(400).json({ message: "ID employé manquant dans l’URL." });
    }

    // ✅ authMiddleware doit avoir posé req.user
    const requester = req.user;
    if (!requester) {
      logger.warn({ msg: "user.resetCompanyPassword.noRequester", employeeId });
      return res.status(401).json({ message: "Non authentifié." });
    }

    const allowedRoles = ["admin", "entreprise", "boss"];
    if (!allowedRoles.includes(requester.role)) {
      logger.warn({
        msg: "user.resetCompanyPassword.forbiddenRole",
        employeeId,
        role: requester.role,
      });
      return res.status(403).json({
        message: "Accès refusé : seuls admin / entreprise / boss peuvent réinitialiser un mot de passe employé.",
      });
    }

    // 🔎 On récupère l’employé
    const employee = await UserModel.findById(employeeId);
    if (!employee) {
      logger.warn({ msg: "user.resetCompanyPassword.employeeNotFound", employeeId });
      return res.status(404).json({ message: "Employé introuvable." });
    }

    // 🔗 On attend un companyId sur l’employé
    const companyId = employee.companyId;
    if (!companyId) {
      logger.warn({
        msg: "user.resetCompanyPassword.noCompanyId",
        employeeId,
      });
      return res.status(400).json({
        message:
          "Cet utilisateur n'est pas rattaché à une entreprise (companyId manquant).",
      });
    }

    // 🏢 Récupérer la company pour lire defaultPassword
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      logger.warn({
        msg: "user.resetCompanyPassword.companyNotFound",
        employeeId,
        companyId,
      });
      return res.status(404).json({ message: "Entreprise introuvable pour cet employé." });
    }

    // 🔐 Mot de passe par défaut : priorité à company.defaultPassword
    let defaultPassword: string;

    if (company.defaultPassword && typeof company.defaultPassword === "string") {
      defaultPassword = company.defaultPassword;
    } else {
      // Fallback de sécurité si jamais defaultPassword n’est pas défini
      defaultPassword = "izyGl@m" + new Date().getFullYear() + "!";
    }

    // ✅ On applique le nouveau mot de passe
    employee.password = defaultPassword;
    await employee.save(); // hook mongoose => hash du mot de passe

    // On nettoie la réponse (pas de password ni tokens)
    const safeEmployee = employee.toObject();
    delete (safeEmployee as any).password;
    delete (safeEmployee as any).resetPasswordToken;
    delete (safeEmployee as any).resetPasswordExpires;

    logger.info({
      msg: "user.resetCompanyPassword.success",
      employeeId,
      companyId,
    });

    return res.status(200).json({
      message: "Mot de passe réinitialisé avec succès pour cet employé.",
      employee: safeEmployee,
    });
  } catch (error: any) {
    logger.error({
      msg: "user.resetCompanyPassword.error",
      employeeId: (req as any)?.params?.id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    console.error("Erreur resetCompanyPassword:", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la réinitialisation du mot de passe.",
    });
  }
};


const getUserById = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "user.getById.start", id });
    const user = await UserModel.findById(id);
    if (user) {
      logger.info({ msg: "user.getById.success", id });
      res.json(user);
    } else {
      logger.warn({ msg: "user.getById.notFound", id });
      res.status(404).json({ message: "Utilisateur non trouvé 333" });
    }
  } catch (error: any) {
    logger.error({ msg: "user.getById.error", id: req?.params?.id, errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer l'utilisateur" });
  }
};

export const handleFacebookLogin = async (req: any, res: express.Response) => {
  try {
    const { accessToken } = req.body;
    logger.info({ msg: "auth.facebook.start", tokenPresent: !!accessToken });

    if (!accessToken) {
      logger.warn({ msg: "auth.facebook.missingToken" });
      return res.status(400).json({ message: "Access token manquant." });
    }

    const userProfileResponse = await axios.get(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name&access_token=${accessToken}`
    );
    const { id: facebookId, email, first_name, last_name } = userProfileResponse.data;

    let user = await UserModel.findOne({ email });

    if (!user) {
      user = await UserModel.create({
        firstname: first_name,
        lastname: last_name,
        email,
        password: '',
        role: "user",
        facebook: {
          userId: facebookId,
          accessToken,
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        phone: "",
        conversationId: "",
        sex: "male",
        fidelity: { stars: 0, card_expiration: new Date(), rewards_history: [] }
      });
      logger.info({ msg: "auth.facebook.userCreated", userId: user._id?.toString() });
    } else {
      if (!user.active) {
        logger.warn({ msg: "auth.facebook.notActivated", userId: user._id?.toString() });
        return res.status(403).json({
          message: "Votre compte n’est pas encore activé. Veuillez vérifier vos emails."
        });
      }

      const originalFirstname = user.firstname;
      const originalLastname = user.lastname;

      if (!originalFirstname || originalFirstname.trim() === '') user.firstname = first_name;
      if (!originalLastname || originalLastname.trim() === '') user.lastname = last_name;

      user.facebook.accessToken = accessToken;
      user.facebook.tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      user.facebook.userId = facebookId;

      await user.save();
      logger.info({ msg: "auth.facebook.userUpdated", userId: user._id?.toString() });
    }

    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    logger.info({ msg: "auth.facebook.success", userId: user._id?.toString() });
    return res.status(200).json({
      message: "Connexion réussie.",
      token: jwtToken,
      user,
    });
  } catch (error: any) {
    logger.error({ msg: "auth.facebook.error", errorMessage: error?.message, stack: error?.stack });
    console.error("Erreur Facebook login:", error);
    return res.status(500).json({
      message: "Erreur lors de la connexion via Facebook.",
      error: error.message,
    });
  }
};

const getUsersByCompanyId = async (req: any, res: express.Response) => {
  try {
    const { companyId } = req.params;
    logger.info({ msg: "user.listByCompany.start", companyId });
    const user = await UserModel.find({ companyId: companyId });
    if (user) {
      logger.info({ msg: "user.listByCompany.success", companyId, count: user.length });
      res.json(user);
    } else {
      logger.warn({ msg: "user.listByCompany.notFound", companyId });
      res.status(404).json({ message: "Utilisateurs non trouvé" });
    }
  } catch (error: any) {
    logger.error({ msg: "user.listByCompany.error", companyId: req?.params?.companyId, errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer les utilisateurs" });
  }
};

const addUserAddress = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.params.id;
    logger.info({ msg: "user.addAddress.start", userId });
    const newAddress = (req as any).body.address;

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $push: { address: newAddress } },
      { new: true }
    );

    if (!updatedUser) {
      logger.warn({ msg: "user.addAddress.notFound", userId });
      return res.status(404).json({ message: "Utilisateur non trouvé 444" });
    }

    logger.info({ msg: "user.addAddress.success", userId });
    res.json(updatedUser);
  } catch (error: any) {
    logger.error({ msg: "user.addAddress.error", userId: (req as any)?.params?.id, errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Erreur lors de l'ajout de l'adresse", error });
  }
};

const updateUserPassword = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "user.updatePassword.start", id });
    const { password } = (req as any).body;

    const user = await UserModel.findById(id);
    if (user) {
      user.password = password;
      await user.save();
      logger.info({ msg: "user.updatePassword.success", id });
      res.json(user);
    } else {
      logger.warn({ msg: "user.updatePassword.notFound", id });
      res.status(404).json({ message: "Utilisateur non trouvé 555" });
    }
  } catch (error: any) {
    logger.error({ msg: "user.updatePassword.error", id: (req as any)?.params?.id, errorMessage: error?.message, stack: error?.stack });
    console.error(error);
    res.status(500).json({ message: "Impossible de récupérer l'utilisateur" });
  }
};

const updateUserById = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "user.update.start", id });

    // Copie des champs reçus
    const updates: Record<string, any> = { ...req.body };

    // On protège certains champs sensibles (mais on LAISSE passer 'active')
    delete (updates as any).password;
    delete (updates as any)._id;
    delete (updates as any).email;
    delete (updates as any).emailVerificationToken;
    delete (updates as any).emailVerificationExpires;
    delete (updates as any).role;

    // Récupération du token (support "Bearer xxx")
    const rawAuth = req.header("authorization") || req.header("Authorization");
    const token = rawAuth?.replace(/^Bearer\s+/i, "");
    if (!token) {
      logger.warn({ msg: "user.update.missingToken", id });
      return res.status(401).json({ message: "Token d'authentification manquant" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY as string,
      async (err: any, decodedToken: { userId: string; role: string }) => {
        if (err) {
          logger.warn({ msg: "user.update.invalidToken", id });
          return res.status(403).json({ message: "Token d'authentification invalide" });
        }

        // Marque la MÀJ
        updates.updatedAt = new Date().toISOString();

        // ⚠️ Si tu veux réserver la MÀJ de 'active' à un rôle précis, décommente et adapte :
        // if (typeof updates.active !== "undefined" && decodedToken.role !== "admin") {
        //   delete updates.active;
        // }

        const updatedUser = await UserModel.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true, runValidators: true, context: "query" }
        );

        if (!updatedUser) {
          logger.warn({ msg: "user.update.notFound", id });
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        logger.info({ msg: "user.update.success", id });
        return res.json(updatedUser);
      }
    );
  } catch (error: any) {
    logger.error({
      msg: "user.update.error",
      id: req?.params?.id,
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Erreur serveur lors de la mise à jour" });
  }
};

const getUsersAllCount = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    logger.info({ msg: "user.countAll.start" });
    const users = await UserModel.find();
    const usersCount = users.length;
    logger.info({ msg: "user.countAll.success", count: usersCount });
    res.status(200).json(usersCount);
  } catch (error: any) {
    logger.error({ msg: "user.countAll.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de récupérer le nombre d'utilisateurs" });
  }
};

const deleteUserById = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "user.delete.start", id });

    const token = req.header("Authorization");
    if (!token) {
      logger.warn({ msg: "user.delete.missingToken", id });
      return res
        .status(401)
        .json({ message: "Token d'authentification manquant 4" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any; role: string }) => {
        if (err) {
          logger.warn({ msg: "user.delete.invalidToken", id });
          return res
            .status(403)
            .json({ message: "Token d'authentification invalide" });
        }

        const userRole = decodedToken.role;
        if (userRole !== "admin" && userRole !== "entreprise") {
          logger.warn({ msg: "user.delete.forbiddenRole", id, roleTried: userRole });
          return res.status(403).json({
            message:
              "Accès refusé : seuls les administrateurs peuvent supprimer des utilisateurs",
          });
        }

        const deletedUser = await UserModel.findByIdAndDelete(id);
        if (deletedUser) {
          logger.info({ msg: "user.delete.success", id });
          res.json({ message: "Utilisateur supprimé avec succès" });
        } else {
          logger.warn({ msg: "user.delete.notFound", id });
          res.status(404).json({ message: "Utilisateur non trouvé 777" });
        }
      }
    );
  } catch (error: any) {
    logger.error({ msg: "user.delete.error", id: req?.params?.id, errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de supprimer l'utilisateur" });
  }
};

export const updateAbonnement = async (req: any, res: express.Response) => {
  const { userId, abonnement, abonnement_end } = req.body;

  try {
    logger.info({ msg: "user.updateAbonnement.start", userId, abonnement });
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn({ msg: "user.updateAbonnement.notFound", userId });
      return res.status(404).json({ message: "User not found" });
    }

    user.abonnement = abonnement;
    user.abonnement_end = abonnement_end ? new Date(abonnement_end) : null;
    await user.save();

    logger.info({ msg: "user.updateAbonnement.success", userId });
    res.status(200).json({ message: "Abonnement updated successfully." });
  } catch (error: any) {
    logger.error({ msg: "user.updateAbonnement.error", userId, errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Error updating abonnement.", error: error.message });
  }
};

export const updateUserFavorites = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    logger.info({ msg: "user.updateFavorites.start", id });
    const { favoriteShops } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      logger.warn({ msg: "user.updateFavorites.notFound", id });
      return res.status(404).json({ message: "Utilisateur non trouvé 888" });
    }

    user.favoriteShops = favoriteShops;
    await user.save();

    logger.info({ msg: "user.updateFavorites.success", id, count: favoriteShops?.length });
    res.status(200).json({ message: "Favoris mis à jour avec succès", user });
  } catch (error: any) {
    logger.error({ msg: "user.updateFavorites.error", id: req?.params?.id, errorMessage: error?.message, stack: error?.stack });
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la mise à jour des favoris" });
  }
};

async function incrementStars(userId: string) {
  logger.info({ msg: "user.incrementStars.start", userId });
  const user = await UserModel.findById(userId);
  user!.fidelity.stars += 1;
  if (user!.fidelity.stars >= 10) {
    user!.fidelity.rewards_history.push({
      reward_name: "Prestation gratuite 🎁",
      reward_date: new Date(),
      type: "win"
    });
    user!.fidelity.stars = 0;
  }
  await user!.save();
  logger.info({ msg: "user.incrementStars.success", userId, stars: user!.fidelity.stars });
}

const getBossEmployees = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "boss.getEmployees.start" });
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      logger.warn({ msg: "boss.getEmployees.forbidden", bossId });
      return res.status(403).json({ message: "Accès interdit" });
    }

    const employees = await UserModel.find({ _id: { $in: boss.employeesIds } });
    logger.info({ msg: "boss.getEmployees.success", bossId, count: employees.length });
    res.status(200).json(employees);
  } catch (error: any) {
    logger.error({ msg: "boss.getEmployees.error", errorMessage: error?.message, stack: error?.stack });
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des employés" });
  }
};

const addEmployeeToBoss = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "boss.addEmployee.start" });
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const { employeeId } = req.body;

    const boss = await UserModel.findById(bossId);
    const employee = await UserModel.findById(employeeId);

    if (!boss || boss.role !== "boss") {
      logger.warn({ msg: "boss.addEmployee.forbidden", bossId });
      return res.status(403).json({ message: "Seuls les patrons peuvent ajouter des employés." });
    }

    if (!employee || employee.role !== "professionnel") {
      logger.warn({ msg: "boss.addEmployee.invalidEmployee", employeeId });
      return res.status(400).json({ message: "L'utilisateur n'est pas un professionnel valide." });
    }

    const abonnementLimits: any = { free: 1, basic: 3, pro: 10, custom: Infinity };
    if ((boss.employeesIds || []).length >= abonnementLimits[boss.abonnement]) {
      logger.warn({ msg: "boss.addEmployee.limitReached", bossId, abonnement: boss.abonnement });
      return res.status(403).json({ message: "Limite d’employés atteinte pour votre abonnement." });
    }

    if (!(boss.employeesIds || []).includes(employeeId)) {
      boss.employeesIds = boss.employeesIds || [];
      boss.employeesIds.push(employeeId);
      await boss.save();
    }

    employee.managerId = bossId;
    await employee.save();

    logger.info({ msg: "boss.addEmployee.success", bossId, employeeId });
    res.status(200).json({ message: "Employé ajouté avec succès au patron." });
  } catch (error: any) {
    logger.error({ msg: "boss.addEmployee.error", errorMessage: error?.message, stack: error?.stack });
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l’ajout de l’employé au patron" });
  }
};

const removeEmployeeFromBoss = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "boss.removeEmployee.start" });
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const { employeeId } = req.body;

    const boss = await UserModel.findById(bossId);
    const employee = await UserModel.findById(employeeId);

    if (!boss || boss.role !== "boss") {
      logger.warn({ msg: "boss.removeEmployee.forbidden", bossId });
      return res.status(403).json({ message: "Seuls les patrons peuvent supprimer des employés." });
    }

    if (!employee || employee.managerId !== bossId) {
      logger.warn({ msg: "boss.removeEmployee.notLinked", employeeId, bossId });
      return res.status(400).json({ message: "Cet employé n'est pas rattaché à vous." });
    }

    boss.employeesIds = (boss.employeesIds || []).filter((id: string) => id !== employeeId);
    await boss.save();

    employee.managerId = undefined;
    await employee.save();

    logger.info({ msg: "boss.removeEmployee.success", bossId, employeeId });
    res.status(200).json({ message: "Employé retiré avec succès du patron." });
  } catch (error: any) {
    logger.error({ msg: "boss.removeEmployee.error", errorMessage: error?.message, stack: error?.stack });
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la suppression de l’employé du patron" });
  }
};

const createAndAddEmployeeToBoss = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "boss.createAndAddEmployee.start" });

    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const { email, firstname, lastname } = req.body;

    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      logger.warn({ msg: "boss.createAndAddEmployee.forbidden", bossId });
      return res.status(403).json({ message: "Seuls les patrons peuvent ajouter des employés." });
    }

    const abonnementLimits: any = { free: 1, basic: 3, pro: 10, custom: Infinity };
    const currentEmployees = boss.employeesIds || [];
    if (currentEmployees.length >= abonnementLimits[boss.abonnement]) {
      logger.warn({ msg: "boss.createAndAddEmployee.limitReached", bossId, abonnement: boss.abonnement });
      return res.status(403).json({ message: "Limite d’employés atteinte pour votre abonnement." });
    }

    let employee = await UserModel.findOne({ email });
    if (employee) {
      if (employee.managerId) {
        logger.warn({ msg: "boss.createAndAddEmployee.alreadyLinked", employeeId: employee._id?.toString() });
        return res.status(400).json({ message: "Cet utilisateur est déjà rattaché à un autre patron." });
      }
      if (employee.role !== "professionnel") {
        logger.warn({ msg: "boss.createAndAddEmployee.invalidRole", employeeId: employee._id?.toString(), role: employee.role });
        return res.status(400).json({ message: "L'utilisateur existe mais n’est pas un professionnel." });
      }
    } else {
      const tempPassword = "izyGlam2026!";
      employee = new UserModel({
        email, firstname, lastname, role: "professionnel", password: tempPassword,
        managerId: bossId, phone: "0000000000", conversationId: "pending_" + Date.now(),
        sex: "female",
        fidelity: { stars: 0, card_expiration: new Date(), rewards_history: [] },
      });
      await employee.save();
      logger.info({ msg: "boss.createAndAddEmployee.createdEmployee", employeeId: employee._id?.toString() });
    }

    boss.employeesIds = boss.employeesIds || [];
    if (!boss.employeesIds.includes(employee._id)) {
      boss.employeesIds.push(employee._id);
      await boss.save();
    }

    employee.managerId = bossId;
    await employee.save();

    logger.info({ msg: "boss.createAndAddEmployee.success", bossId, employeeId: employee._id?.toString() });
    res.status(200).json({ message: "Employé ajouté/créé avec succès", employee });
  } catch (error: any) {
    logger.error({ msg: "boss.createAndAddEmployee.error", errorMessage: error?.message, stack: error?.stack });
    console.error("❌ Erreur dans createAndAddEmployeeToBoss :", error);
    res.status(500).json({ message: "Erreur lors de l’ajout ou création de l’employé", error: error.message });
  }
};

const getSubscriptionInfo = async (req: any, res: express.Response) => {
  try {
    logger.info({ msg: "user.subInfo.start" });
    const token = req.header("Authorization");

    if (!token) {
      logger.warn({ msg: "user.subInfo.missingToken" });
      return res.status(401).json({ message: "Token d'authentification manquant" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any }) => {
        if (err) {
          logger.warn({ msg: "user.subInfo.invalidToken" });
          return res.status(403).json({ message: "Token d'authentification invalide" });
        }

        const userId = decodedToken.userId;
        const user = await UserModel.findById(userId);
        if (!user) {
          logger.warn({ msg: "user.subInfo.userNotFound", userId });
          return res.status(404).json({ message: "Utilisateur non trouvé 111" });
        }
        const isExpired = user.abonnement_end ? new Date(user.abonnement_end) < new Date() : false;

        logger.info({ msg: "user.subInfo.success", userId, isExpired });
        res.json({ abonnement: user.abonnement, abonnement_end: user.abonnement_end, isExpired });
      }
    );
  } catch (error: any) {
    logger.error({ msg: "user.subInfo.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

const subscribeToPlan = async (req: any, res: express.Response) => {
  const { newPlan, durationInMonths } = req.body;
  logger.info({ msg: "user.subscribe.start", newPlan });

  if (!["free", "basic", "pro", "custom"].includes(newPlan)) {
    logger.warn({ msg: "user.subscribe.invalidPlan", newPlan });
    return res.status(400).json({ message: "Type d'abonnement invalide" });
  }

  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      logger.warn({ msg: "user.subscribe.userNotFound", reqUserId: req.user?._id });
      return res.status(404).json({ message: "Utilisateur non trouvé 222" });
    }

    user.abonnement = newPlan;
    if (newPlan === "free") {
      user.abonnement_end = null;
    } else {
      const now = new Date();
      const currentEnd = user.abonnement_end && user.abonnement_end > now ? user.abonnement_end : now;
      user.abonnement_end = new Date(currentEnd.setMonth(currentEnd.getMonth() + durationInMonths));
    }

    await user.save();

    logger.info({ msg: "user.subscribe.success", userId: user._id?.toString(), newPlan, end: user.abonnement_end });
    res.json({ message: `Abonnement mis à jour vers ${newPlan}`, abonnement_end: user.abonnement_end });
  } catch (error: any) {
    logger.error({ msg: "user.subscribe.error", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

/**
 * POST /users/:id/pro-client-notes
 * Body: { comment: string, shopId?: string, bookingId?: string }
 * -> Ajoute une note interne écrite par un pro sur un client.
 *
 * + BLOQUE si un pro a déjà commenté CE booking (booking.proCommentAdded = true)
 */
/**
 * POST /users/:id/pro-client-notes
 * Body: { comment: string, shopId?: string, bookingId: string }
 *
 * Ajoute une note interne écrite par un pro sur un client.
 * 🔒 Un seul commentaire pro possible par booking (proCommentAdded).
 */
const addProClientNoteToClient = async (req: any, res: express.Response) => {
  try {
    const clientId = String(req.params.id || "").trim();
    const author = req.user; // posé par authMiddleware
    const { comment, shopId, bookingId } = req.body || {};

    logger.info({
      msg: "user.addProClientNote.start",
      clientId,
      authorId: author?._id?.toString(),
      authorRole: author?.role,
      bookingId,
    });

    /* ------------------ Sécurité de base ------------------ */

    if (!clientId) {
      return res.status(400).json({ message: "clientId manquant dans l’URL." });
    }

    const cleanComment = String(comment || "").trim();
    if (!cleanComment || cleanComment.length < 2) {
      return res.status(400).json({ message: "Commentaire invalide." });
    }

    const safeBookingId = String(bookingId || "").trim();
    if (!safeBookingId) {
      return res.status(400).json({
        message: "bookingId manquant : impossible de garantir un seul commentaire par réservation.",
      });
    }

    /* ------------------ Récupération client ------------------ */

    const clientUser = await UserModel.findById(clientId);
    if (!clientUser) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    if (String(clientUser._id) === String(author._id)) {
      return res.status(400).json({ message: "Impossible de commenter votre propre compte." });
    }

    /* ------------------ Lock booking (anti doublon) ------------------ */

    const lockedBooking = await bookingModel.findOneAndUpdate(
      { _id: safeBookingId, proCommentAdded: false },
      { $set: { proCommentAdded: true } },
      { new: true }
    );

    if (!lockedBooking) {
      const exists = await bookingModel
        .findById(safeBookingId)
        .select("_id proCommentAdded");

      if (!exists) {
        return res.status(404).json({ message: "Réservation introuvable." });
      }

      return res.status(409).json({
        message: "Un commentaire prestataire a déjà été ajouté pour cette réservation.",
      });
    }

    /* ------------------ Vérifications métier ------------------ */

    const authorId = String(author._id);

    if (String(lockedBooking.userProId) !== authorId && author.role !== "admin") {
      await bookingModel.updateOne(
        { _id: safeBookingId },
        { $set: { proCommentAdded: false } }
      );
      return res.status(403).json({
        message: "Accès refusé : réservation non associée à ce prestataire.",
      });
    }

    if (String(lockedBooking.clientId) !== String(clientId)) {
      await bookingModel.updateOne(
        { _id: safeBookingId },
        { $set: { proCommentAdded: false } }
      );
      return res.status(400).json({
        message: "Le client ne correspond pas à cette réservation.",
      });
    }

    if (shopId && String(lockedBooking.shopId) !== String(shopId)) {
      await bookingModel.updateOne(
        { _id: safeBookingId },
        { $set: { proCommentAdded: false } }
      );
      return res.status(400).json({
        message: "Le shopId ne correspond pas à cette réservation.",
      });
    }

    /* ------------------ Enregistrement note ------------------ */

    const note = {
      authorId: author._id,
      shopId: shopId || lockedBooking.shopId,
      bookingId: safeBookingId,
      comment: cleanComment,
      createdAt: new Date(),
    };

    clientUser.proClientNotes = clientUser.proClientNotes || [];
    clientUser.proClientNotes.push(note as any);

    clientUser.updatedAt = new Date().toISOString();
    await clientUser.save();

    logger.info({
      msg: "user.addProClientNote.success",
      clientId,
      bookingId: safeBookingId,
      notesCount: clientUser.proClientNotes.length,
    });

    return res.status(201).json({
      message: "Commentaire enregistré.",
      note,
    });
  } catch (error: any) {
    logger.error({
      msg: "user.addProClientNote.error",
      errorMessage: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({
      message: "Erreur serveur.",
      error: error?.message,
    });
  }
};



module.exports = {
  getAllByAdminOptions,
  getUsersAllCount,
  getUsersByCompanyId,
  getUserInfo,
  registerUserNoToken,
  loginUserSMS,
  loginUser,
  loginVerifSMS,
  createUser,
  updateUserPassword,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  refreshToken,
  updateUserFavorites,
  updateAbonnement,
  geolocation,
  handleFacebookLogin,
  forgotPassword,
  resetPassword,
  addUserAddress,
  getBossEmployees,
  addEmployeeToBoss,
  incrementStars,
  subscribeToPlan,
  getSubscriptionInfo,
  removeEmployeeFromBoss,
<<<<<<< HEAD
=======
  updateUserCountryById,
  resetEmployeePasswordFromCompany,
>>>>>>> 77a6b31adbc8eb4911b1f6592bb3df3481d198e7
  verifyEmail,
  resendVerificationEmail,
  addProClientNoteToClient,
  createAndAddEmployeeToBoss,
};
