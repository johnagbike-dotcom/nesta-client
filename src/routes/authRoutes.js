// routes/authRoutes.js
import { Router } from "express";
const router = Router();

// TODO: replace with real auth (Firebase Admin / session middleware)
router.get("/me", (req, res) => {
  // If you have a session: const user = req.user;
  // Temporary: return null user so guards redirect to login
  res.json({ user: null });
});

export default router;
