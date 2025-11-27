// src/config.js
export const DEV_MODE =
  process.env.REACT_APP_DEV_MODE === "true"; // you already have this

// use a real UID later; for now any string is fine
export const TEST_HOST_ID =
  process.env.REACT_APP_TEST_HOST_ID || "demo-host-uid";

// convenience alias: in dev, bypass gates like “must have confirmed booking”
export const DEV_BYPASS_GATES = DEV_MODE; 