"use client";

import { Menu } from "lucide-react";

export default function TopBarMobileMenuToggle() {
  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent("orbitwork:open-mobile-nav"));
  };

  return (
    <button
      type="button"
      className="mobile-nav-toggle-btn"
      onClick={handleOpen}
      aria-label="Open navigation menu"
      title="Open menu"
    >
      <Menu size={20} />
    </button>
  );
}
