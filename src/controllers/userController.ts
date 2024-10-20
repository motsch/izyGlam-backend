import UserModel from "../models/user";
import * as express from "express";
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
      new (): any;
      json: { (arg0: { message?: string; error?: string }): void; new (): any };
    };
    json: (arg0: {
      companyId: string;
      lastname: string;
      email: string;
      firstname: string;
      role: string;
      phone: string;
      sex: string;
      address: any[];
      proches: any[];
      favoriteShops: any[];
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
      sex: string;
      address: any[];
      proches: any[];
      favoriteShops: any[];
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
          const { lastname, email, firstname, role, address, proches, phone, sex, companyId, _id, favoriteShops } =
            user;
          res.json({
            lastname,
            email,
            firstname,
            role,
            address,
            proches,
            phone,
            sex,
            companyId,
            favoriteShops,
            _id
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
      new (): any;
      json: { (arg0: { message: string }): void; new (): any };
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
    res.status(500).json({ message: "Impossible de créer l'utilisateur => " + JSON.stringify(error) });
  }
};

// Récupérer tous les utilisateurs
const getAllUsers = async (
  req: any,
  res: {
    json: (arg0: any) => void;
    status: (arg0: number) => {
      (): any;
      new (): any;
      json: { (arg0: { message: string }): void; new (): any };
    };
  }
) => {
  try {
    const users = await UserModel.find()/*.select(
      "firstname email lastname role"
    );*/
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
      res.status(404).json({ message: "Utilisateur non trouvé" });
    }
  } catch (error) {
    res.status(500).json({ message: "Impossible de récupérer l'utilisateur" });
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
    res.status(500).json({ message: "Impossible de récupérer les utilisateurs" });
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
      res.status(404).json({ message: "Utilisateur non trouvé" });
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
    const { username, email, role, lastname, firstname } = req.body;
    // Récupérer le token d'authentification à partir de l'en-tête de la demande
    const token = req.header("Authorization");
    if (!token) {
      return res
        .status(401)
        .json({ message: "Token d'authentification manquant 3" });
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
        if (userRole === "professionnel") {
          return res.status(403).json({
            message:
              "Accès refusé : Un compte professionnel ne peut pas modifier un utilisateur",
          });
        }
        const updatedUser = await UserModel.findByIdAndUpdate(
          id,
          { username, email, role, lastname, firstname },
          { new: true }
        );
        if (updatedUser) {
          res.json(updatedUser);
        } else {
          res.status(404).json({ message: "Utilisateur non trouvé" });
        }
      }
    );
  } catch (error) {
    res
      .status(500)
      .json({ message: "Impossible de mettre à jour l'utilisateur" });
  }
};

// Supprimer un utilisateur par son ID
const deleteUserById = async (
  req: any,
  res: {
    json: (arg0: { message: string }) => void;
    status: (arg0: number) => {
      (): any;
      new (): any;
      json: { (arg0: { message?: string; error?: string }): void; new (): any };
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
          res.status(404).json({ message: "Utilisateur non trouvé" });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Impossible de supprimer l'utilisateur" });
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
      return res.status(404).json({ message: "Utilisateur non trouvé" });
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
    res.status(500).json({ message: "Erreur lors de la mise à jour des favoris" });
  }
};

module.exports = {
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
};
