// src/app/docs/public/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getPublicDoc } from "@/lib/docs/service";
import Link from "next/link";
import { BrandMark } from "@/app/BrandMark";
import { Globe, Clock } from "lucide-react";
import "@/app/app-styles.css";
import "@/app/documents.css";

export const dynamic = "force-dynamic";

export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const docData = await getPublicDoc(slug);

  if (!docData) {
    notFound();
  }

  const { doc, activePage } = docData;

  return (
    <div className="public-doc-shell">
      <header className="public-doc-header">
        <div className="public-doc-header-inner">
          <div className="public-doc-brand">
            <BrandMark size={20} />
            <span>OrbitWork Published Doc</span>
          </div>
          <div className="public-doc-badge">
            <Globe size={13} />
            <span>Public View</span>
          </div>
        </div>
      </header>

      <main className="public-doc-main">
        <article className="public-doc-article">
          <div className="public-doc-title-row">
            <span className="public-doc-icon">{activePage.icon || doc.icon || "📄"}</span>
            <h1>{activePage.title || doc.title}</h1>
          </div>

          <div className="public-doc-meta">
            <Clock size={13} />
            <span>Updated {new Date(doc.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>

          {doc.description && <p className="public-doc-desc">{doc.description}</p>}

          <hr className="public-doc-divider" />

          <div
            className="document-rendered public-doc-content"
            dangerouslySetInnerHTML={{ __html: activePage.html }}
          />
        </article>
      </main>

      <footer className="public-doc-footer">
        <p>Published with OrbitWork Knowledge Hub</p>
      </footer>
    </div>
  );
}
