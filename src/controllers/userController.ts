import UserModel from "../models/user";
import * as express from "express";
import { Request } from "express";
import axios from 'axios';
import path from "path"; // Pour manipuler les chemins locaux

import ConversationModel from "../models/conversation";
import crypto from "crypto";
import nodemailer from "nodemailer";
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
      firstname: string;
      role: string;
      phone: string;
      conversationId: string;
      sex: string;
      bank: any;
      customerId: string;
      address: any[];
      proches: any[];
      favoriteShops: any[];
      fidelity: any[];
      abonnement: string;
    }) => void;
  }
) => {
  try {
    // Définissez un type pour l'objet que vous renvoyez
    type UserInfo = {
      companyId: string;
      lastname: string;
      email: string;
      firstname: string;
      role: string; // Ajoutez la propriété "role" au type
      phone: string;
      conversationId: string;
      sex: string;
      customerId: string;
      abonnement: string;
      address: any[];
      proches: any[];
      bank: any;
      favoriteShops: any[];
      fidelity: any;
      _id: string;
    };
    const token = req.header("Authorization");

    if (!token) {
      return res
        .status(401)
        .json({ message: "Token d'authentification manquant" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any }) => {
        if (err) {
          return res
            .status(403)
            .json({ message: "Token d'authentification invalide" });
        }

        const userId = decodedToken.userId;

        const user = await UserModel.findById(userId);
        if (user) {
          // Le user a été trouvé, renvoyer ses informations (sans le mot de passe)
          const {
            lastname,
            email,
            firstname,
            role,
            address,
            proches,
            phone,
            sex,
            customerId,
            bank,
            companyId,
            _id,
            favoriteShops,
            fidelity,

            abonnement,
            conversationId,
          } = user;
          res.json({
            lastname,
            email,
            firstname,
            role,
            address,
            proches,
            phone,
            conversationId,
            sex,
            bank,
            abonnement,
            customerId,
            companyId,
            favoriteShops,
            fidelity,
            _id,
          } as UserInfo);
        } else {
          // Le user n'a pas été trouvé (ceci ne devrait pas se produire si le token est valide)
          res.status(404).json({ message: "User non trouvé" });
        }
      }
    );
  } catch (error) {
    console.error("Error:", error); // Vérifier s'il y a des erreurs dans la récupération des données
    res.status(500).json({
      message: "Erreur lors de la récupération des informations du user",
    });
  }
};


// Fonction de refresh du token
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
    const userId = req.userId;

    // Créez un nouveau token avec une nouvelle expiration
    const token = jwt.sign({ userId }, process.env.SECRET_KEY, {
      expiresIn: "72h",
    });

    res.json({ message: "Token rafraîchi avec succès", token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors du rafraîchissement du token" });
  }
};

// Fonction de register pour créer un nouvel utilisateur avec mot de passe chiffré
const registerUserNoToken = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const myUser = req.body;
    if (
      myUser.email !== "admin@developpeurfreelance.com" ||
      myUser.lastname !== "Admin" ||
      myUser.firstname !== "DeveloppeurFreelance" ||
      myUser.role !== "DeveloppeurFreelance"
    ) {
      return res
        .status(401)
        .json({ message: "Une erreur s'est produite. Veuillez recommencer !" });
    }
    const existingUser = await UserModel.findOne(myUser.email);
    if (existingUser) {
      return res.status(409).json({
        message: "Cet email est déjà utilisé par un autre utilisateur",
      });
    }
    const newUser = new UserModel(myUser);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({
      message: "Impossible de créer l'utilisateur => " + JSON.stringify(error),
    });
  }
};

// Fonction de login pour vérifier les informations d'identification de l'utilisateur
const loginVerifSMS = async (
  req: { body: { sid: any; code: any; connectKey: any } },
  res: express.Response
) => {
  try {
    const { sid, code, connectKey } = req.body;
    // Vérifier le code envoyé par l'utilisateur
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
            return res.status(401).json({ message: "Not found" });
          }
          // Créer un token JWT signé avec la clé secrète
          const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.SECRET_KEY,
            {
              expiresIn: "60h",
            }
          );
          res.json({ message: sid + " : Connexion réussie", token });
        } else {
          res.status(401).json({ message: "Code de vérification invalide" });
        }
      })
      .catch((error: any) => {
        console.error(error);
        res.status(500).send("Failed to verify code");
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la connexion" });
  }
};



// Fonction de login pour vérifier les informations d'identification de l'utilisateur
const loginUserSMS = async (
  req: { body: { email: any; phone: any } },
  res: express.Response
) => {
  try {
    console.log("IN LOG");
    const { email, phone } = req.body;
    let user: any = null;
    if (email) {
      user = await UserModel.findOne({ email });
    } else if (phone) {
      user = await UserModel.findOne({ phone });
    }
    if (!user) {
      return res.status(401).json({ message: "Not found" });
    }
    // Envoi de SMS avec Twilio
    const code = Math.floor(100000 + Math.random() * 900000); // Génère un code à 6 chiffres

    client.messages
      .create({
        body: `Votre code de vérification est ${code}`,
        to: user.phone, // Numéro de téléphone envoyé par l'utilisateur
        from: "+14152372836",
      })
      .then((message: any) => {
        console.log(message.sid);
        // Stockez `code` dans votre base de données/session
        console.log("SMS sent successfully");
        let connectKey = {
          sid: message.sid,
          identifiant: user.phone,
        };
        res.json({ message: user._id + " : Connexion en cours", connectKey });
      })
      .catch((error: any) => {
        console.error(error);
        res.status(500).send("Failed to send SMS");
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la connexion" });
  }
};
// Fonction de login pour vérifier les informations d'identification de l'utilisateur
const loginUser = async (
  req: { body: { email: any; password: any } },
  res: express.Response
) => {
  try {
    console.log("IN LOG");
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });
    const test = await UserModel.find({});
    if (!user) {
      console.log("user not found ???")
      return res.status(401).json({ message: "Email invalide", test: test });
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Mot de passe invalide" });
    }
    // Créer un token JWT signé avec la clé secrète
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.SECRET_KEY,
      {
        expiresIn: "72h",
      }
    );
    res.json({ message: user._id + " : Connexion réussie", token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Une erreur est survenue lors de la connexion" });
  }
};

// Forgot password: Send reset link
export const forgotPassword = async (req: express.Request, res: express.Response) => {
  const { email } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 heure

    await user.save();

    const resetLink = `${req.protocol}://localhost:4200/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: 'ssl0.ovh.net',
      port: 465,
      secure: true, // Utilisation de SSL
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const logoPath = path.join(__dirname, "../../uploads/images/logo/logo.png"); // Chemin absolu du logo
    const currentYear = new Date().getFullYear(); // Récupère l'année actuelle

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation de mot de passe</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
          }
          .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(90deg, #ff95c1ff, #ffdcecff);
            padding: 20px;
            text-align: center;
          }
          .header img {
            max-width: 150px;
          }
          .content {
            padding: 20px;
            color: #333333;
            text-align: left;
          }
          .content h1 {
            color: #ff8fbeff;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .content p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .button-container {
            text-align: center;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 15px 20px;
            font-size: 16px;
            color: #ffffffff !important;
            background: linear-gradient(90deg, #ffdcecff, #ff95c1ff);
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .button:hover {
            opacity: 0.9;
          }
          .footer {
            text-align: center;
            background-color: #f4f4f4;
            padding: 10px;
            color: #888888;
            font-size: 14px;
          }
          .footer a {
            color: #ff8fbeff;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <img src="cid:logo" alt="izyGlam Logo">
          </div>
          <div class="content">
            <h1>Réinitialisation de votre mot de passe</h1>
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte izyGlam. Cliquez sur le bouton ci-dessous pour continuer.</p>
            <div class="button-container">
              <a class="button" href="${resetLink}" target="_blank">Réinitialiser mon mot de passe</a>
            </div>
            <p>Ce lien est valable pendant 1 heure. Si vous n'avez pas fait cette demande, veuillez ignorer cet email.</p>
            <p>Merci,<br>L'équipe izyGlam</p>
          </div>
          <div class="footer">
            <p>Besoin d'aide ? <a href="mailto:support@izyglam.com">support@izyglam.com</a></p>
            <p>&copy; ${currentYear} izyGlam. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: 'contact@izyglam.com',
      to: email,
      subject: 'Réinitialisation de votre mot de passe - izyGlam',
      html: htmlContent,
      attachments: [
        {
          filename: 'fr.png',
          path: logoPath, // Chemin vers le logo
          cid: 'logo', // Content-ID pour l'inclusion dans le HTML
        },
      ],
    });

    console.log('Message sent: %s', info.messageId);

    res.status(200).json({ message: `Password reset email sent to ${email}` });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ message: "Error sending reset email", error });
  }
};




// Reset password
export const resetPassword = async (req: express.Request, res: express.Response) => {
  const { token, newPassword } = req.body;
  try {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = newPassword; // Ensure password hashing is implemented in UserModel
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password successfully reset" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error });
  }
};

// Créer un nouvel utilisateur
const createUser = async (req: express.Request, res: express.Response) => {
  try {
    console.log("IN CREATE");
    const myUser = req.body;
    const newUser = new UserModel(myUser);
    console.log("newUser : " + JSON.stringify(newUser));
    // Récupérer le token d'authentification à partir de l'en-tête de la demande
    // const token = req.header("Authorization");

    /*if (!token) {
        return res
          .status(401)
          .json({ message: "Token d'authentification manquant 2" });
      }*/

    // Vérifier et décoder le token JWT pour obtenir le rôle de l'utilisateur
    /*jwt.verify(
        token,
        process.env.SECRET_KEY,
        async (err: any, decodedToken: { userId: any; role: string }) => {
          if (err) {
            return res
              .status(403)
              .json({ message: "Token d'authentification invalide" });
          }
  
          const userRole = decodedToken.role;
          // Vérifier le rôle de l'utilisateur avant de permettre la suppression
          if (userRole !== "admin" && userRole !== "DeveloppeurFreelance") {
            return res
              .status(403)
              .json({
                message:
                  "Accès refusé : seuls les administrateurs peuvent créer des utilisateurs",
              });
          }
          await newUser.save();
          res.status(201);
          res.send(newUser);
        }
      );*/

    await newUser.save();
    res.status(201);
    res.send(newUser);
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          "Impossible de créer l'utilisateur => " + JSON.stringify(error),
      });
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const geolocation = async (req: any, res: any) => {
  const userIP = getUserIP(req);

  if (userIP === '8.8.8.8') {
    console.log('IP locale détectée, utilisation d\'une localisation par défaut.');
    res.json({
      city: 'Paris',
      country: 'France',
      latitude: 48.8566,
      longitude: 2.3522,
    });
    return;
  }

  try {
    const response = await axios.get(`https://ipapi.co/${userIP}/json/`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Erreur lors de la récupération de la localisation :', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération de la localisation.' });
  }
};

const getUserIP = (req: any) => {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Si l'application tourne en local, utiliser une IP fictive
  if (ip === '::1' || ip === '127.0.0.1') {
    ip = '8.8.8.8'; // Exemple : IP publique de test (Google DNS)
  }

  return Array.isArray(ip) ? ip[0] : ip; // Récupérer uniquement l'adresse IP
};

// Récupérer tous les utilisateurs
const getAllUsers = async (req: any, res: express.Response) => {
  try {
    console.log("get users");
    const users = await UserModel.find(); /*.select(
      "firstname email lastname role"
    );*/
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de récupérer les utilisateurs" });
  }
};

// Récupérer tous les utilisateurs
const getAllByAdminOptions = async (req: any, res: express.Response) => {
  try {
    // Récupération depuis req.query car les paramètres sont dans l'URL
    const { pays, type } = req.body;
    console.log("get users");
    const users = await UserModel.find({ role: type });

    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de récupérer les utilisateurs" });
  }
};

// Récupérer un utilisateur par son ID
const getUserById = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "Utilisateur non trouvé 333" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer l'utilisateur" });
  }
};

export const handleFacebookLogin = async (req: any, res: express.Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      console.log("Access token manquant dans la requête");
      return res.status(400).json({ message: "Access token manquant." });
    }

    // Récupération du profil Facebook
    const userProfileResponse = await axios.get(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name&access_token=${accessToken}`
    );
    const { id: facebookId, email, first_name, last_name } = userProfileResponse.data;
    console.log("Données Facebook:", userProfileResponse.data);

    let user = await UserModel.findOne({ email });
    console.log("User récupéré AVANT TOUTE MODIF :", JSON.stringify(user, null, 2));

    if (!user) {
      // Création utilisateur si non existant
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
        sex: "male", // Valeur par défaut obligatoire d'après ton modèle
        fidelity: {
          stars: 0,
          card_expiration: new Date(),
          rewards_history: [],
        }
      });
      console.log("Utilisateur créé:", user);
    } else {
      // CLONER les valeurs d’origine pour ne pas perdre les infos avant modif
      const originalFirstname = user.firstname;
      const originalLastname = user.lastname;

      console.log("Avant modif: firstname =", originalFirstname, "lastname =", originalLastname);
      console.log("Données Facebook: firstname =", first_name, "lastname =", last_name);

      // Ne pas modifier si déjà présent
      if (!originalFirstname || originalFirstname.trim() === '') {
        user.firstname = first_name;
        console.log("Mise à jour du prénom via Facebook");
      } else {
        console.log("Prénom conservé");
      }

      if (!originalLastname || originalLastname.trim() === '') {
        user.lastname = last_name;
        console.log("Mise à jour du nom via Facebook");
      } else {
        console.log("Nom conservé");
      }

      // Mise à jour token FB
      user.facebook.accessToken = accessToken;
      user.facebook.tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      user.facebook.userId = facebookId;

      await user.save();
      console.log("Utilisateur mis à jour:", user);
    }

    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Connexion réussie.",
      token: jwtToken,
      user,
    });
  } catch (error: any) {
    console.error("Erreur Facebook login:", error);
    return res.status(500).json({
      message: "Erreur lors de la connexion via Facebook.",
      error: error.message,
    });
  }
};




// Récupérer un utilisateur par son ID
const getUsersByCompanyId = async (req: any, res: express.Response) => {
  try {
    const { companyId } = req.params;
    // console.log("companyId : "+companyId)
    const user = await UserModel.find({ companyId: companyId });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "Utilisateurs non trouvé" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de récupérer les utilisateurs" });
  }
};
// Ajoute une nouvelle adresse à l'utilisateur identifié par son id
const addUserAddress = async (
  req: express.Request,
  res: express.Response) => {
  try {
    const userId = req.params.id; // On attend l'id dans l'URL (ex: /users/:id/address)
    const newAddress = req.body.address; // On attend l'adresse dans le body sous { address: { ... } }

    // Utilise $push pour ajouter la nouvelle adresse à l'array address
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $push: { address: newAddress } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé 444" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'ajout de l'adresse", error });
  }
};

const updateUserPassword = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.params;
    const { password } = req.body; // Utilisation de req.body pour obtenir le mot de passe depuis le corps de la requête

    const user = await UserModel.findById(id);
    if (user) {
      user.password = password;
      console.log("user : " + JSON.stringify(user));
      console.log("user.password : " + user.password);
      await user.save();
      res.json(user);
    } else {
      res.status(404).json({ message: "Utilisateur non trouvé 555" });
    }
  } catch (error) {
    console.error(error); // Ajout d'une console.error pour afficher les erreurs dans la console
    res.status(500).json({ message: "Impossible de récupérer l'utilisateur" });
  }
};

// Mettre à jour un utilisateur par son ID
const updateUserById = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body }; // Récupère tout ce qui est dans req.body

    // Sécurité : On interdit de modifier certains champs sensibles
    delete updates.password;
    delete updates._id;
    delete updates.email; // <-- selon ta politique de modification d'email

    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ message: "Token d'authentification manquant" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: string; role: string }) => {
        if (err) {
          return res.status(403).json({ message: "Token d'authentification invalide" });
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
          id,
          updates, // <-- on passe tous les champs autorisés
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "Utilisateur non trouvé 666" });
        }

        res.json(updatedUser);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour" });
  }
};

const getUsersAllCount = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const users = await UserModel.find();
    const usersCount = users.length;
    res.status(200).json(usersCount);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de récupérer le nombre d'utilisateurs" });
  }
};

// Supprimer un utilisateur par son ID
const deleteUserById = async (
  req: any,
  res: {
    json: (arg0: { message: string }) => void;
    status: (arg0: number) => {
      (): any;
      new(): any;
      json: { (arg0: { message?: string; error?: string }): void; new(): any };
    };
  }
) => {
  try {
    const { id } = req.params;
    // Récupérer le token d'authentification à partir de l'en-tête de la demande
    const token = req.header("Authorization");

    if (!token) {
      return res
        .status(401)
        .json({ message: "Token d'authentification manquant 4" });
    }

    // Vérifier et décoder le token JWT pour obtenir le rôle de l'utilisateur
    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any; role: string }) => {
        if (err) {
          return res
            .status(403)
            .json({ message: "Token d'authentification invalide" });
        }

        const userRole = decodedToken.role;
        // Vérifier le rôle de l'utilisateur avant de permettre la suppression
        if (userRole !== "admin" && userRole !== "entreprise") {
          return res.status(403).json({
            message:
              "Accès refusé : seuls les administrateurs peuvent supprimer des utilisateurs",
          });
        }

        const deletedUser = await UserModel.findByIdAndDelete(id);
        if (deletedUser) {
          res.json({ message: "Utilisateur supprimé avec succès" });
        } else {
          res.status(404).json({ message: "Utilisateur non trouvé 777" });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer l'utilisateur" });
  }
};

// Fonction pour mettre à jour l'abonnement de l'utilisateur
export const updateAbonnement = async (req: any, res: express.Response) => {
  const { userId, abonnement, abonnement_end } = req.body;

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.abonnement = abonnement;
    user.abonnement_end = abonnement_end ? new Date(abonnement_end) : null;
    await user.save();

    res.status(200).json({ message: "Abonnement updated successfully." });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error updating abonnement.", error: error.message });
  }
};

// Fonction pour mettre à jour les favoris de l'utilisateur
export const updateUserFavorites = async (req: any, res: express.Response) => {
  try {
    const { id } = req.params; // Récupérer l'ID de l'utilisateur à partir des paramètres
    const { favoriteShops } = req.body; // Récupérer le tableau de favoris du corps de la requête

    // Vérifier si l'utilisateur existe
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé 888" });
    }

    // Mettre à jour les favoris de l'utilisateur
    user.favoriteShops = favoriteShops;

    // Sauvegarder les modifications dans la base de données
    await user.save();
    // console.log("SUCCESS : ")
    // console.log(user);
    // Répondre avec un message de succès et les données utilisateur mises à jour
    res.status(200).json({ message: "Favoris mis à jour avec succès", user });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour des favoris" });
  }
};

const connectToBluesky = async (req: express.Request, res: express.Response) => {
  const { handle, password } = req.body;
  const userId = req.params.userId;

  try {
    // URL correcte pour se connecter via ATProto
    const response = await axios.post('https://bsky.social/xrpc/com.atproto.server.createSession', {
      identifier: handle,
      password: password,
    });

    const accessToken = response.data.accessJwt; // Jeton d'accès
    const refreshToken = response.data.refreshJwt || null; // Jeton de rafraîchissement

    // Mettre à jour l'utilisateur avec le token obtenu
    await UserModel.findByIdAndUpdate(userId, {
      'bluesky.accessToken': accessToken,
      'bluesky.tokenExpiresAt': new Date(Date.now() + 3600 * 1000), // Exemple : expiration dans 1h
      ...(refreshToken && { 'bluesky.refreshToken': refreshToken }),
    });

    return res.status(200).json({
      message: 'Connexion réussie et jeton sauvegardé.',
      accessToken,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    });
  } catch (error) {
    console.error('Erreur lors de la connexion à Bluesky :', error);
    return res.status(500).json({ error: 'Connexion échouée.' });
  }
};

const postToBluesky = async (req: express.Request, res: express.Response) => {
  const { content } = req.body;
  const userId = req.params.userId;

  try {
    // Récupérer l'utilisateur et son token
    const user = await UserModel.findById(userId);
    if (!user || !user.bluesky || !user.bluesky.accessToken) {
      return res.status(401).json({ error: 'Utilisateur non connecté à Bluesky.' });
    }

    // Publier un post via ATProto
    const response = await axios.post(
      'https://bsky.social/xrpc/com.atproto.repo.createRecord',
      {
        repo: user.bluesky.userId,
        collection: 'app.bsky.feed.post',
        record: {
          text: content,
          createdAt: new Date().toISOString(),
        },
      },
      {
        headers: { Authorization: `Bearer ${user.bluesky.accessToken}` },
      }
    );

    return res.status(200).json({ message: 'Post publié avec succès.', data: response.data });
  } catch (error) {
    console.error('Erreur lors de la publication sur Bluesky :', error);
    return res.status(500).json({ error: 'Impossible de publier le post.' });
  }
};

const revokeBlueskyAccess = async (req: express.Request, res: express.Response) => {
  const userId = req.params.userId;

  try {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { bluesky: '' },
    });
    return res.status(200).json({ message: 'Accès Bluesky révoqué.' });
  } catch (error) {
    console.error('Erreur lors de la révocation :', error);
    return res.status(500).json({ error: 'Impossible de révoquer l\'accès.' });
  }
};

async function incrementStars(userId: string) {
  const user = await UserModel.findById(userId);
  user!.fidelity.stars += 1;
  if (user!.fidelity.stars >= 10) {
    user!.fidelity.rewards_history.push({
      reward_name: "Prestation gratuite 🎁",
      reward_date: new Date(),
      type: "win"
    });
    user!.fidelity.stars = 0; // remise à zéro après récompense
  }
  await user!.save();
}


const getBossEmployees = async (req: any, res: express.Response) => {
  try {
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      return res.status(403).json({ message: "Accès interdit" });
    }

    const employees = await UserModel.find({ _id: { $in: boss.employeesIds } });
    res.status(200).json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des employés" });
  }
};

const addEmployeeToBoss = async (req: any, res: express.Response) => {
  try {
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const { employeeId } = req.body;

    const boss = await UserModel.findById(bossId);
    const employee = await UserModel.findById(employeeId);

    if (!boss || boss.role !== "boss") {
      return res.status(403).json({ message: "Seuls les patrons peuvent ajouter des employés." });
    }

    if (!employee || employee.role !== "professionnel") {
      return res.status(400).json({ message: "L'utilisateur n'est pas un professionnel valide." });
    }

    // Vérifie la limite selon l’abonnement
    const abonnementLimits: any = {
      free: 1,
      basic: 3,
      pro: 10,
      custom: Infinity,
    };

    if ((boss.employeesIds || []).length >= abonnementLimits[boss.abonnement]) {
      return res.status(403).json({
        message: "Limite d’employés atteinte pour votre abonnement.",
      });
    }

    if (!(boss.employeesIds || []).includes(employeeId)) {
      boss.employeesIds = boss.employeesIds || [];
      boss.employeesIds.push(employeeId);
      await boss.save();
    }


    // Lien employé → patron
    employee.managerId = bossId;
    await employee.save();

    res.status(200).json({ message: "Employé ajouté avec succès au patron." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l’ajout de l’employé au patron" });
  }
};

const removeEmployeeFromBoss = async (req: any, res: express.Response) => {
  try {
    const token = req.header("Authorization");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;

    const { employeeId } = req.body;

    const boss = await UserModel.findById(bossId);
    const employee = await UserModel.findById(employeeId);

    if (!boss || boss.role !== "boss") {
      return res.status(403).json({ message: "Seuls les patrons peuvent supprimer des employés." });
    }

    if (!employee || employee.managerId !== bossId) {
      return res.status(400).json({ message: "Cet employé n'est pas rattaché à vous." });
    }

    // Suppression du lien boss → employé
    boss.employeesIds = (boss.employeesIds || []).filter((id: string) => id !== employeeId);
    await boss.save();

    // Suppression du lien employé → boss
    employee.managerId = undefined;
    await employee.save();

    res.status(200).json({ message: "Employé retiré avec succès du patron." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la suppression de l’employé du patron" });
  }
};

const createAndAddEmployeeToBoss = async (req: any, res: express.Response) => {
  try {
    console.log("🔥 Début createAndAddEmployeeToBoss");

    const token = req.header("Authorization");
    console.log("📨 Token reçu :", token);

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const bossId = decoded.userId;
    console.log("✅ Token décodé. ID du boss :", bossId);

    const { email, firstname, lastname } = req.body;
    console.log("📩 Données reçues :", { email, firstname, lastname });

    const boss = await UserModel.findById(bossId);
    if (!boss || boss.role !== "boss") {
      console.warn("⛔ Utilisateur non trouvé ou non boss :", boss);
      return res.status(403).json({ message: "Seuls les patrons peuvent ajouter des employés." });
    }

    console.log("✅ Boss trouvé :", boss.email, "| Abonnement :", boss.abonnement);

    const abonnementLimits: any = {
      free: 1,
      basic: 3,
      pro: 10,
      custom: Infinity,
    };

    const currentEmployees = boss.employeesIds || [];
    console.log("📊 Employés actuels :", currentEmployees.length, "/", abonnementLimits[boss.abonnement]);

    if (currentEmployees.length >= abonnementLimits[boss.abonnement]) {
      console.warn("⛔ Limite d’employés atteinte");
      return res.status(403).json({
        message: "Limite d’employés atteinte pour votre abonnement.",
      });
    }

    let employee = await UserModel.findOne({ email });
    if (employee) {
      console.log("👀 Utilisateur avec cet email déjà existant :", employee.email);

      if (employee.managerId) {
        console.warn("⚠️ Déjà rattaché à un patron :", employee.managerId);
        return res.status(400).json({ message: "Cet utilisateur est déjà rattaché à un autre patron." });
      }

      if (employee.role !== "professionnel") {
        console.warn("⚠️ Utilisateur existant mais rôle invalide :", employee.role);
        return res.status(400).json({ message: "L'utilisateur existe mais n’est pas un professionnel." });
      }

    } else {
      console.log("🚧 Aucun utilisateur trouvé. Création d’un nouveau professionnel...");

      const tempPassword = "izyGlam2026!";
      employee = new UserModel({
        email,
        firstname,
        lastname,
        role: "professionnel",
        password: tempPassword,
        managerId: bossId,
        phone: "0000000000", // champ requis
        conversationId: "pending_" + Date.now(), // champ requis
        sex: "female", // valeur temporaire obligatoire (adapter si possible)
        fidelity: {
          stars: 0,
          card_expiration: new Date(),
          rewards_history: [],
        },
      });

      await employee.save();
      console.log("✅ Employé créé :", employee.email);
    }
    // 🛠️ Assure-toi que employeesIds est un tableau
    boss.employeesIds = boss.employeesIds || [];
    // Ajout du lien boss → employé
    if (!boss.employeesIds.includes(employee._id)) {
      boss.employeesIds.push(employee._id);
      await boss.save();
      console.log("🔗 Employé ajouté à la liste du boss");
    } else {
      console.log("ℹ️ Employé déjà dans la liste du boss");
    }

    // Vérification et sauvegarde du lien employé → boss
    employee.managerId = bossId;
    await employee.save();
    console.log("✅ Lien employé → boss mis à jour");

    res.status(200).json({ message: "Employé ajouté/créé avec succès", employee });

  } catch (error: any) {
    console.error("❌ Erreur dans createAndAddEmployeeToBoss :", error);
    res.status(500).json({ message: "Erreur lors de l’ajout ou création de l’employé", error: error.message });
  }
};

// Get subscription info
const getSubscriptionInfo = async (req: any, res: express.Response) => {
  try {

    const token = req.header("Authorization");

    if (!token) {
      return res
        .status(401)
        .json({ message: "Token d'authentification manquant" });
    }

    jwt.verify(
      token,
      process.env.SECRET_KEY,
      async (err: any, decodedToken: { userId: any }) => {
        if (err) {
          return res
            .status(403)
            .json({ message: "Token d'authentification invalide" });
        }

        console.log("Token => " + JSON.stringify(decodedToken))
        const userId = decodedToken.userId;
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "Utilisateur non trouvé 111" });
        //const user = await UserModel.findById(req.user._id).select("abonnement abonnement_end");
        const isExpired = user.abonnement_end ? new Date(user.abonnement_end) < new Date() : false;

        res.json({
          abonnement: user.abonnement,
          abonnement_end: user.abonnement_end,
          isExpired,
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// Subscribe to new plan
const subscribeToPlan = async (req: any, res: express.Response) => {
  const { newPlan, durationInMonths } = req.body;

  if (!["free", "basic", "pro", "custom"].includes(newPlan)) {
    return res.status(400).json({ message: "Type d'abonnement invalide" });
  }

  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé 222" });

    // Met à jour l'abonnement
    user.abonnement = newPlan;

    // Calcule la nouvelle date de fin d'abonnement
    if (newPlan === "free") {
      user.abonnement_end = null;
    } else {
      const now = new Date();
      const currentEnd = user.abonnement_end && user.abonnement_end > now ? user.abonnement_end : now;
      user.abonnement_end = new Date(currentEnd.setMonth(currentEnd.getMonth() + durationInMonths));
    }

    await user.save();

    res.json({ message: `Abonnement mis à jour vers ${newPlan}`, abonnement_end: user.abonnement_end });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

module.exports = {
  getAllByAdminOptions,
  revokeBlueskyAccess,
  connectToBluesky,
  postToBluesky,
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
  createAndAddEmployeeToBoss,
};
