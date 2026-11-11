"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavorite } from "@/app/actions";

type Props = {
  entityType: "document" | "project" | "task";
  entityId: string;
  projectId?: string | null;
  title: string;
  subtitle?: string;
  initialFavorited: boolean;
  label?: string;
  compact?: boolean;
  className?: string;
};

export default function FavoriteButton({
  entityType,
  entityId,
  projectId,
  title,
  subtitle = "",
  initialFavorited,
  label,
  compact = false,
  className = "",
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);

    const fd = new FormData();
    fd.set("entityType", entityType);
    fd.set("entityId", entityId);
    if (projectId) fd.set("projectId", projectId);
    fd.set("title", title);
    if (subtitle) fd.set("subtitle", subtitle);

    startTransition(async () => {
      const res = await toggleFavorite(fd);
      if (res.ok) {
        setFavorited(res.favorited);
      } else {
        setFavorited(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={favorited}
      title={favorited ? "Remove from Favorites" : "Add to Favorites"}
      className={`favorite-toggle-btn${favorited ? " is-favorited" : ""}${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <Star
        size={compact ? 13 : 14}
        fill={favorited ? "currentColor" : "none"}
      />
      {label !== undefined ? (
        <span>{label}</span>
      ) : !compact ? (
        <span>{favorited ? "Favorited" : "Favorite"}</span>
      ) : null}
    </button>
  );
}
