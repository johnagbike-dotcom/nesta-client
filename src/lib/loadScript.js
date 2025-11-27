// src/lib/loadScript.js
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") return resolve(true);
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => reject(new Error("script load error")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.setAttribute("data-loaded", "true");
      resolve(true);
    };
    s.onerror = () => reject(new Error("script load error"));
    document.body.appendChild(s);
  });
}