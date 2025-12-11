import React from "react";
import PartnerListingsPage from "./PartnerListingsPage";

export default function HostListingsPage() {
  // mode="host" tells the shared page to query ownerId instead of partnerId
  return (
    <PartnerListingsPage
      headingOverride="Host — Manage listings"
      mode="host"
    />
  );
}
