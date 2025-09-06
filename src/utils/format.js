// tiny helpers used across pages
export const formatNaira = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

export const firstPhoto = (photoUrls) =>
  Array.isArray(photoUrls) && photoUrls.length ? photoUrls[0] : null; 




