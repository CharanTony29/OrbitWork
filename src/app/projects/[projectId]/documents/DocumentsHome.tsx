"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, LayoutGrid, List, Plus, Search, SortAsc } from "lucide-react";
import FavoriteButton from "@/app/FavoriteButton";
import { quickCreateProjectDocument } from "@/app/actions";

type DocumentItem = { id: string; title: string; body_markdown: string; updated_at: string; created_at: string; created_by: string };
type Filter = "all" | "mine" | "favorites";

export default function DocumentsHome({ projectId, projectName, documents, currentUserId, favoriteDocIds }: {
  projectId: string; projectName: string; documents: DocumentItem[]; currentUserId: string; favoriteDocIds: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => documents.filter((doc) => {
    if (filter === "mine" && doc.created_by !== currentUserId) return false;
    if (filter === "favorites" && !favoriteDocIds.includes(doc.id)) return false;
    return `${doc.title} ${doc.body_markdown}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "created" ? Date.parse(b.created_at) - Date.parse(a.created_at) : Date.parse(b.updated_at) - Date.parse(a.updated_at)), [documents, filter, favoriteDocIds, query, sort, currentUserId]);

  async function createDocument(template?: "meeting" | "project") {
    setCreating(true); setError("");
    const title = template === "meeting" ? "Meeting notes" : template === "project" ? "Project brief" : "Untitled document";
    const body = template === "meeting"
      ? "<h1>Meeting notes</h1><p><strong>Date:</strong> </p><h2>Attendees</h2><ul><li></li></ul><h2>Agenda</h2><p></p><h2>Decisions</h2><p></p><h2>Action items</h2><ul><li></li></ul>"
      : template === "project" ? "<h1>Project brief</h1><h2>Overview</h2><p></p><h2>Goals</h2><ul><li></li></ul><h2>Milestones</h2><p></p><h2>Owners</h2><p></p>" : "<p></p>";
    const form = new FormData(); form.set("projectId", projectId); form.set("title", title); form.set("body", body);
    const result = await quickCreateProjectDocument(form);
    if (result?.ok && result.document) router.push(`/projects/${projectId}/documents/${result.document.id}`);
    else { setError("The document could not be created. Check your access and try again."); setCreating(false); }
  }

  return <section className="docs-home">
    <header className="docs-home-header"><div><div className="docs-home-eyebrow">{projectName} / Workspace</div><h1>Documents</h1><p>Keep project knowledge, decisions, and working notes in one place.</p></div>
      <div className="docs-home-create"><button className="docs-create-primary" disabled={creating} onClick={() => createDocument()}><Plus size={16}/>{creating ? "Creating…" : "New document"}</button>
        <div className="docs-template-actions"><button onClick={() => createDocument("meeting")} disabled={creating}>Meeting notes</button><button onClick={() => createDocument("project")} disabled={creating}>Project brief</button></div>
      </div>
    </header>
    {error && <p role="alert" className="docs-home-error">{error}</p>}
    <nav className="docs-home-tabs" aria-label="Document views">
      {([["all", "All documents"], ["mine", "Created by me"], ["favorites", "Favorites"]] as const).map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}
    </nav>
    <div className="docs-home-controls"><label className="docs-home-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles and content" aria-label="Search documents"/></label>
      <div className="docs-home-control-right"><label className="docs-sort"><SortAsc size={15}/><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort documents"><option value="updated">Recently updated</option><option value="name">Name</option><option value="created">Recently created</option></select></label>
        <div className="docs-view-switch" aria-label="Document layout"><button aria-label="List view" aria-pressed={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={16}/></button><button aria-label="Grid view" aria-pressed={view === "grid"} className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><LayoutGrid size={16}/></button></div>
      </div>
    </div>
    {visible.length ? <div className={`docs-home-list ${view}`}>
      {visible.map((doc) => { const preview = doc.body_markdown.replace(/<!--\s*doc-meta:[\s\S]*?-->\s*/i, "").replace(/<[^>]*>/g, " ").replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
        return <article key={doc.id} className="docs-home-card"><a href={`/projects/${projectId}/documents/${doc.id}`} className="docs-home-card-main"><span className="docs-home-icon"><FileText size={18}/></span><span className="docs-home-card-copy"><strong>{doc.title}</strong><span className="docs-home-preview">{preview || "No preview available"}</span></span></a>
          <span className="docs-home-date">Updated {new Date(doc.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><FavoriteButton entityType="document" entityId={doc.id} projectId={projectId} title={doc.title} subtitle={`${projectName} · Document`} initialFavorited={favoriteDocIds.includes(doc.id)} compact label="Favorite"/>
        </article>;
      })}
    </div> : <div className="docs-home-empty"><span><BookOpen size={22}/></span><h2>{query ? "No documents found" : filter === "favorites" ? "No favorites yet" : "Start your project knowledge base"}</h2><p>{query ? "Try a different title or phrase." : filter === "favorites" ? "Favorite a document to keep it close at hand." : "Create a document for plans, meeting notes, and decisions."}</p>{!documents.length && <button className="docs-create-primary" onClick={() => createDocument()} disabled={creating}><Plus size={16}/>Create your first document</button>}</div>}
  </section>;
}
