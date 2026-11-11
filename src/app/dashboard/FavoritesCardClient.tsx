"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckSquare,
  FileText,
  FolderKanban,
  Plus,
  Star,
  X,
} from "lucide-react";
import { toggleFavorite } from "@/app/actions";

export type FavoriteRecord = {
  id?: string;
  entity_type: "document" | "project" | "task";
  entity_id: string;
  project_id: string | null;
  title: string;
  subtitle: string;
};

export type QuickPinCandidate = {
  entity_type: "document" | "project" | "task";
  entity_id: string;
  project_id: string | null;
  title: string;
  subtitle: string;
};

function getFavoriteHref(item: FavoriteRecord) {
  if (item.entity_type === "document" && item.project_id) {
    return `/projects/${item.project_id}/documents/${item.entity_id}`;
  }
  if (item.entity_type === "task" && item.project_id) {
    return `/projects/${item.project_id}/tasks/${item.entity_id}`;
  }
  if (item.entity_type === "project") {
    return `/projects/${item.entity_id}`;
  }
  return "/dashboard";
}

function FavoriteIcon({ type }: { type: FavoriteRecord["entity_type"] }) {
  if (type === "document") return <FileText size={14} />;
  if (type === "project") return <FolderKanban size={14} />;
  return <CheckSquare size={14} />;
}

export default function FavoritesCardClient({
  initialFavorites,
  candidates,
  tableAvailable,
}: {
  initialFavorites: FavoriteRecord[];
  candidates: QuickPinCandidate[];
  tableAvailable: boolean;
}) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>(initialFavorites);
  const [tab, setTab] = useState<"all" | "document" | "project" | "task">("all");
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const favoriteKeySet = new Set(
    favorites.map((f) => `${f.entity_type}:${f.entity_id}`)
  );

  const availableCandidates = candidates.filter(
    (c) => !favoriteKeySet.has(`${c.entity_type}:${c.entity_id}`)
  );

  const visibleFavorites =
    tab === "all"
      ? favorites
      : favorites.filter((f) => f.entity_type === tab);

  function handleUnfavorite(item: FavoriteRecord) {
    setErrorMsg(null);
    const prev = favorites;
    setFavorites((curr) =>
      curr.filter(
        (f) => !(f.entity_type === item.entity_type && f.entity_id === item.entity_id)
      )
    );

    const fd = new FormData();
    fd.set("entityType", item.entity_type);
    fd.set("entityId", item.entity_id);
    if (item.project_id) fd.set("projectId", item.project_id);
    fd.set("title", item.title);
    if (item.subtitle) fd.set("subtitle", item.subtitle);

    startTransition(async () => {
      const res = await toggleFavorite(fd);
      if (!res.ok) {
        setFavorites(prev);
        setErrorMsg(res.error ?? "Could not remove favorite.");
      }
    });
  }

  function handleAddFavorite() {
    if (!selectedCandidateKey) return;
    const picked = availableCandidates.find(
      (c) => `${c.entity_type}:${c.entity_id}` === selectedCandidateKey
    );
    if (!picked) return;

    setErrorMsg(null);
    const optimistic: FavoriteRecord = {
      entity_type: picked.entity_type,
      entity_id: picked.entity_id,
      project_id: picked.project_id,
      title: picked.title,
      subtitle: picked.subtitle,
    };
    const prev = favorites;
    setFavorites((curr) => [optimistic, ...curr]);
    setSelectedCandidateKey("");

    const fd = new FormData();
    fd.set("entityType", picked.entity_type);
    fd.set("entityId", picked.entity_id);
    if (picked.project_id) fd.set("projectId", picked.project_id);
    fd.set("title", picked.title);
    if (picked.subtitle) fd.set("subtitle", picked.subtitle);

    startTransition(async () => {
      const res = await toggleFavorite(fd);
      if (!res.ok) {
        setFavorites(prev);
        setErrorMsg(res.error ?? "Could not add favorite.");
      }
    });
  }

  return (
    <article className="user-dash-panel">
      <header className="user-dash-panel-head">
        <div>
          <p className="eyebrow">QUICK ACCESS</p>
          <h3>
            <Star size={15} className="user-fav-star-title" />
            <span>Favorites</span>
            <span className="count-pill">{favorites.length}</span>
          </h3>
        </div>
        <div className="user-dash-filter-pills" role="tablist" aria-label="Filter favorites">
          {(["all", "document", "project", "task"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`user-dash-filter-pill${tab === key ? " is-active" : ""}`}
              onClick={() => setTab(key)}
            >
              {key === "all"
                ? "All"
                : key === "document"
                ? "Docs"
                : key === "project"
                ? "Projects"
                : "Tasks"}
            </button>
          ))}
        </div>
      </header>

      {!tableAvailable && (
        <p className="muted small" style={{ marginBottom: 10 }}>
          Run database migration <code>202611110001_dashboard_favorites_and_dpdp_erasure.sql</code> in Supabase to persist favorites.
        </p>
      )}

      {errorMsg && (
        <p className="error" role="alert" style={{ margin: "0 0 10px", fontSize: 11.5 }}>
          {errorMsg}
        </p>
      )}

      <div className="user-fav-list">
        {visibleFavorites.length > 0 ? (
          visibleFavorites.map((item) => (
            <div className="user-fav-row" key={`${item.entity_type}-${item.entity_id}`}>
              <Link href={getFavoriteHref(item)} className="user-fav-link">
                <span className={`user-fav-icon type-${item.entity_type}`}>
                  <FavoriteIcon type={item.entity_type} />
                </span>
                <span className="user-fav-meta">
                  <strong>{item.title}</strong>
                  <small>
                    {item.entity_type === "document"
                      ? "Document"
                      : item.entity_type === "project"
                      ? "Project"
                      : "Task"}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </small>
                </span>
              </Link>
              <button
                type="button"
                className="user-fav-remove"
                disabled={pending}
                title="Remove from favorites"
                aria-label={`Remove ${item.title} from favorites`}
                onClick={() => handleUnfavorite(item)}
              >
                <X size={13} />
              </button>
            </div>
          ))
        ) : (
          <div className="user-dash-empty">
            <p>
              {favorites.length === 0
                ? "No favorites added yet."
                : `No favorite ${tab}s yet.`}
            </p>
            <small>
              Star any document, project, or task, or add one below for 1-click access.
            </small>
          </div>
        )}
      </div>

      {availableCandidates.length > 0 && tableAvailable && (
        <div className="user-fav-add-bar">
          <select
            value={selectedCandidateKey}
            onChange={(e) => setSelectedCandidateKey(e.target.value)}
            aria-label="Choose a document, project, or task to favorite"
          >
            <option value="">Star a document, project, or task…</option>
            {availableCandidates.map((c) => (
              <option
                key={`${c.entity_type}:${c.entity_id}`}
                value={`${c.entity_type}:${c.entity_id}`}
              >
                [{c.entity_type === "document" ? "Doc" : c.entity_type === "project" ? "Project" : "Task"}] {c.title}
                {c.subtitle ? ` (${c.subtitle})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button-secondary"
            disabled={!selectedCandidateKey || pending}
            onClick={handleAddFavorite}
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>
      )}
    </article>
  );
}
