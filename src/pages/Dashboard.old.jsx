import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";

export default function Dashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role, isSubscribed }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setProfile(null);
        setChecking(false);
        return;
      }
      setUser(u);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : {});
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, []);

  if (checking) {
    return <main className="dash-bg"><div className="container dash-wrap"><p className="muted">Loading…</p></div></main>;
  }

  if (!user) {
    // Should never hit because route is protected, but just in case:
    navigate("/login", { replace: true });
    return null;
  }

  const role = profile?.role ?? null;
  const subscribed = !!profile?.isSubscribed;

  return (
    <main className="dash-bg">
      <div className="container dash-wrap">
        <h1 style={{ marginTop: 8 }}>Your Dashboard</h1>

        {/* Role section */}
        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Role</h3>
          {role ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Current role: <strong>{role}</strong>
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 6 }}>
                You haven’t selected a role yet.
              </p>
              <Link to="/role-selection" className="btn" style={{ marginTop: 10 }}>
                Choose Host or Agent
              </Link>
            </>
          )}
        </div>

        {/* Subscription section */}
        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Subscription</h3>
          {subscribed ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Status: <strong>Active</strong>. Guests with subscriptions can view your phone/email on listings.
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 6 }}>
                Status: <strong>Free</strong>. Contact info (phone/email) on listings is hidden.
              </p>
              <Link to="/subscribe" className="btn" style={{ marginTop: 10 }}>
                Subscribe to unlock contact visibility
              </Link>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Quick actions</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <Link to="/browse" className="btn ghost">Browse listings</Link>
            <Link to="/post-ad" className="btn">Post a listing</Link>
            {!subscribed && <Link to="/subscribe" className="btn">Subscribe</Link>}
          </div>
        </div>
      </div>
    </main>
  );
}