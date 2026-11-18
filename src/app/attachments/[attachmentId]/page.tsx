import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AttachmentFullTabViewer from "./AttachmentFullTabViewer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ attachmentId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { attachmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Attachment Preview" };

  const { data } = await supabase
    .from("task_attachments")
    .select("file_name")
    .eq("id", attachmentId)
    .maybeSingle();

  return {
    title: data?.file_name || "Attachment Preview",
  };
}

export default async function AttachmentViewerPage({ params }: Props) {
  const { attachmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/attachments/${attachmentId}`)}`);
  }

  const { data: attachment, error } = await supabase
    .from("task_attachments")
    .select(
      "id, project_id, task_id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id, external_url"
    )
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--surface, #f8fafc)",
          color: "var(--ink, #0f172a)",
          textAlign: "center",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Attachment not found</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #64748b)" }}>
          This file may have been removed or you may not have access to it.
        </p>
        <Link href="/my-dashboard" className="button button-primary" style={{ marginTop: 6 }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isExternalLink =
    attachment.storage_provider === "external_link" ||
    attachment.mime_type === "application/x-external-link" ||
    Boolean(
      attachment.external_file_id &&
        (attachment.external_file_id.startsWith("http://") ||
          attachment.external_file_id.startsWith("https://"))
    ) ||
    Boolean(
      (attachment.storage_provider === "sharepoint" ||
        attachment.storage_provider === "onedrive") &&
        attachment.external_url &&
        !attachment.external_file_id
    );

  if (isExternalLink && attachment.external_url) {
    redirect(attachment.external_url);
  }

  return (
    <AttachmentFullTabViewer
      attachment={{
        id: attachment.id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type || "application/octet-stream",
        file_size_bytes: attachment.file_size_bytes ?? undefined,
      }}
    />
  );
}
