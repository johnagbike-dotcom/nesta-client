// src/api/listings.js
import { db } from "../firebase";
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
} from "firebase/firestore";

export async function searchListings({
  city = "", area = "", minPrice = 0, maxPrice = 999999999,
  guests = 1, status = "active", pageSize = 12, cursor = null,
}) {
  const col = collection(db, "listings");
  const clauses = [];

  if (status) clauses.push(where("status", "==", status));
  if (city)   clauses.push(where("city", "==", city));
  if (area)   clauses.push(where("area", "==", area));
  // price band
  clauses.push(where("pricePerNight", ">=", Number(minPrice || 0)));
  clauses.push(where("pricePerNight", "<=", Number(maxPrice || 999999999)));
  // capacity (accommodates or guests)
  clauses.push(where("accommodates", ">=", Number(guests || 1)));

  // deterministic sort
  const q = query(
    col,
    ...clauses,
    orderBy("pricePerNight", "asc"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  const snap = await getDocs(cursor ? query(q, startAfter(cursor)) : q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
} 