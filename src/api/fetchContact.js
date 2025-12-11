// src/api/fetchContact.js
import { Router } from "express";
import { db } from "../firebase.js";
import admin from "firebase-admin";

const router = Router();

/*
 * GET /api/contact/:bookingId
 * Returns host/guest contact if reveal conditions are met
 */
router.get("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const snap = await db.collection("bookings").doc(bookingId).get();
    if (!snap.exists) return res.status(404).json({ error: "Booking not found" });

    const b = snap.data();
    const now = Date.now();

    // Determine contact eligibility
    const hostEligible =
      b.status === "confirmed" &&
      b.revealHostAt &&
      new Date(b.revealHostAt).getTime() <= now &&
      b.hostContactRevealed !== false;

    const guestEligible =
      b.status === "confirmed" &&
      b.revealGuestAt &&
      new Date(b.revealGuestAt).getTime() <= now &&
      b.guestContactRevealed !== false;

    // Load host and guest profiles
    const hostUser = b.hostId
      ? await admin.auth().getUser(b.hostId).catch(() => null)
      : null;
    const guestUser = b.userId
      ? await admin.auth().getUser(b.userId).catch(() => null)
      : null;

    return res.json({
      ok: true,
      canSeeHost: hostEligible,
      canSeeGuest: guestEligible,
      host: hostEligible
        ? { email: hostUser?.email || "-", phone: hostUser?.phoneNumber || "-" }
        : null,
      guest: guestEligible
        ? { email: guestUser?.email || "-", phone: guestUser?.phoneNumber || "-" }
        : null,
      revealHostAt: b.revealHostAt || null,
      revealGuestAt: b.revealGuestAt || null,
    });
  } catch (e) {
    console.error("contact lookup failed", e);
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

export default router;
