const express = require("express");
const usersController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

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

// Route to retrieve all users without requiring authentication
router.get("/usersNoToken", usersController.getAllUsers);

// Authenticated route to create a new user
router.post("/users", usersController.createUser);

// Authenticated route to get all users
router.get("/users", authMiddleware, usersController.getAllUsers);

// Authenticated route to get the currently logged-in user's info
router.get("/me", authMiddleware, usersController.getUserInfo);

// Authenticated route to retrieve a user by ID
router.get("/users/:id", authMiddleware, usersController.getUserById);

// get number of users on the platform
router.get("/users-count-all", authMiddleware, usersController.getUsersAllCount);

// Authenticated route to update a user by ID
router.put("/users/:id", authMiddleware, usersController.updateUserById);

// Authenticated route to update a user's password
router.put(
  "/users/:id/password",
  authMiddleware,
  usersController.updateUserPassword
);

// Authenticated route to delete a user by ID
router.delete("/users/:id", authMiddleware, usersController.deleteUserById);

// Route to refresh JWT token using existing session token
router.post("/refresh-token", authMiddleware, usersController.refreshToken);

// Route pour mettre à jour les favoris de l'utilisateur
router.put("/update-user-favs/:id", authMiddleware, usersController.updateUserFavorites);


module.exports = router;
