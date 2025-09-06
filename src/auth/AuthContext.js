// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuth } from "../firebase"; // <- uses onAuthStateChanged inside your firebase.js

const AuthContext = createContext({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // stay true until Firebase answers

  useEffect(() => {
    const unsub = onAuth((u) => {
      setUser(u || null);
      setLoading(false); // important: flip to false as soon as we learn the state
    });
    return () => unsub && unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);