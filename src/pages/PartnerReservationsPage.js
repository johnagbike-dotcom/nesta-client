// src/pages/PartnerReservationsPage.js
import React from "react";
import HostReservationsPage from "./HostReservationsPage";

export default function PartnerReservationsPage() {
  return (
    <HostReservationsPage
      ownerField="partnerUid"
      pageTitle="Partner reservations"
    />
  );
}
