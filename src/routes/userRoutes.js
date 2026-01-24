const express = require("express");
const usersController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Forgot password functionality
router.post("/forgot-password", usersController.forgotPassword);
router.post("/reset-password", usersController.resetPassword);
// ✅ Nouvelle route : reset mot de passe employé par l’entreprise/admin
router.post(
  "/users/:id/reset-company-password",
  authMiddleware,
  usersController.resetEmployeePasswordFromCompany
);
// Route to update the user's abonnement
router.post("/update-abonnement", usersController.updateAbonnement);

// Route to handle user login with standard credentials
router.post("/login", usersController.loginUser);

// Get users by companyId
router.get("/users-by-companyId/:companyId", usersController.getUsersByCompanyId);

// Route to initiate SMS login process
router.post("/login-sms", usersController.loginUserSMS);

// Route to verify SMS code sent to user during the SMS login process
router.post("/login-verif-sms", usersController.loginVerifSMS);

// Route to register a user without requiring a token, potentially for initial setup or testing
router.post("/registerUserNoToken", usersController.registerUserNoToken);

// Route to create a new user without requiring authentication
router.post("/usersNoToken", usersController.createUser);

router.get("/verify-email", usersController.verifyEmail);
router.post("/resend-verification", usersController.resendVerificationEmail);


// Route to retrieve all users without requiring authentication
router.get("/usersNoToken", usersController.getAllUsers);

// Route pour ajouter une adresse à un utilisateur
router.patch("/users/:id/address", usersController.addUserAddress);

// Authenticated route to create a new user
router.post("/users", usersController.createUser);

// Authenticated route to get all users
router.get("/users", authMiddleware, usersController.getAllUsers);

// Authenticated route to get all users
router.put("/admin-users", authMiddleware, usersController.getAllByAdminOptions);

// Authenticated route to get the currently logged-in user's info
router.get("/me", authMiddleware, usersController.getUserInfo);

// Authenticated route to retrieve a user by ID
router.get("/users/:id", authMiddleware, usersController.getUserById);

// get number of users on the platform
router.get("/users-count-all", authMiddleware, usersController.getUsersAllCount);

// Authenticated route to update a user by ID
router.put("/users/:id", authMiddleware, usersController.updateUserById);

// users-country-update route to update a user country by ID
router.put('/users-country-update/:id', authMiddleware, usersController.updateUserCountryById);

// Authenticated route to update a user's password
router.put(
  "/users/:id/password",
  authMiddleware,
  usersController.updateUserPassword
);
router.post('/facebook-login', usersController.handleFacebookLogin);
// Authenticated route to delete a user by ID
router.delete("/users/:id", authMiddleware, usersController.deleteUserById);

// Route to refresh JWT token using existing session token
router.post("/refresh-token", authMiddleware, usersController.refreshToken);

// Route pour mettre à jour les favoris de l'utilisateur
router.put("/update-user-favs/:id", authMiddleware, usersController.updateUserFavorites);

// Route pour mettre à jour les favoris de l'utilisateur
router.get("/geolocation", usersController.geolocation);

// ✅ Notes internes pro -> client (visibles aux pros ensuite)
router.post("/users/:id/pro-client-notes", authMiddleware, usersController.addProClientNoteToClient);


// 👑 Récupérer les employés d’un boss
router.get("/boss/employees", authMiddleware, usersController.getBossEmployees);

// 👑 Ajouter un employé à un boss (et vérifier les limites d’abonnement)
router.post("/boss/add-employee", authMiddleware, usersController.addEmployeeToBoss);

// 👑 Supprimer un employé du boss (désassocier l’employé du patron)
router.post("/boss/remove-employee", authMiddleware, usersController.removeEmployeeFromBoss);

router.post("/boss/create-and-add-employee", authMiddleware, usersController.createAndAddEmployeeToBoss);


router.post("/users-subscribe", authMiddleware, usersController.subscribeToPlan);
router.get("/users-subscription", authMiddleware, usersController.getSubscriptionInfo);


module.exports = router;
