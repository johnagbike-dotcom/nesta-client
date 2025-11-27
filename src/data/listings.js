// src/data/listings.js
export const ALL_LISTINGS = [
  {
    id: "ik_ikeja_room",
    title: "Room in Ikeja GRA",
    location: "Ikeja GRA, Lagos",
    beds: 1,
    baths: 1,
    guests: 1,
    price: 20000,
    photo:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068f9f0?q=80&w=1200&auto=format&fit=crop",
    blurb:
      "Bright, modern room with ensuite bath in a secure estate. Close to malls and business district.",
  },
  {
    id: "lk_lekki_apt",
    title: "Modern Apartment in Lekki Phase 1",
    location: "Lekki Phase 1, Lagos",
    beds: 1,
    baths: 1,
    guests: 1,
    price: 45000,
    photo:
      "https://images.unsplash.com/photo-1494526588595-c41746248156?q=80&w=1200&auto=format&fit=crop",
    blurb:
      "Stylish one-bed apartment with a balcony and fast Wi-Fi. Walkable to restaurants.",
  },
  {
    id: "vi_penthouse",
    title: "Penthouse in Victoria Island",
    location: "Victoria Island, Lagos",
    beds: 3,
    baths: 3,
    guests: 3,
    price: 120000,
    photo:
      "https://images.unsplash.com/photo-1505691723518-36a5ac3b2d52?q=80&w=1200&auto=format&fit=crop",
    blurb:
      "Luxury penthouse with skyline views, private concierge, and premium amenities.",
  },
];

export function getListingById(id) {
  return ALL_LISTINGS.find((l) => l.id === id) || null;
} 