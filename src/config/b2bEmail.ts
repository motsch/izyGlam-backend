// src/config/email.ts

// true si B2B_EMAIL_TEST_MODE vaut "true" (string)
export const B2B_EMAIL_TEST_MODE =
  process.env.B2B_EMAIL_TEST_MODE === "true";

// email de redirection en mode test
export const B2B_EMAIL_TEST_RECIPIENT =
  process.env.B2B_EMAIL_TEST_RECIPIENT || "";
