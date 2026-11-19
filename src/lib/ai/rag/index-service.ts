import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractDocumentText,
  extractMatchingSnippet,
  type DocumentChunk,
} from "./document-parser";

export { extractMatchingSnippet };

export type MatchedConcept = {
  sourceType: "attachment" | "orbitwork_doc" | "doc_page";
  id: string;
  title: string;
  projectId: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  taskKey?: string;
  section: string;
  snippet: string;
  mimeType?: string;
  fileSizeBytes?: number;
  href: string;
};

// In-memory cache for parsed attachment text to prevent repeated extraction in same session
const memoryExtractCache = new Map<
  string,
  {
    fullText: string;
    chunks: DocumentChunk[];
    fileType: string;
  }
>();

/**
 * Indexes an attachment by extracting its content and persisting it to attachment_rag_indexes.
 */
export async function indexAttachment({
  supabase,
  attachmentId,
  buffer,
  fileName,
  mimeType,
  projectId,
  taskId,
}: {
  supabase: SupabaseClient;
  attachmentId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  projectId: string;
  taskId: string;
}) {
  try {
    const parsed = await extractDocumentText(buffer, fileName, mimeType);
    if (!parsed.fullText || parsed.fullText.trim().length === 0) {
      return { ok: false, reason: "No text extractable" };
    }

    memoryExtractCache.set(attachmentId, {
      fullText: parsed.fullText,
      chunks: parsed.chunks,
      fileType: parsed.fileType,
    });

    try {
      const { error: upsertErr } = await supabase.from("attachment_rag_indexes").upsert(
        {
          attachment_id: attachmentId,
          project_id: projectId,
          task_id: taskId,
          file_name: fileName,
          file_type: parsed.fileType,
          extracted_text: parsed.fullText,
          chunks: parsed.chunks,
          indexed_at: new Date().toISOString(),
        },
        { onConflict: "attachment_id" }
      );

      if (upsertErr) {
        // Fallback to SECURITY DEFINER RPC
        await supabase.rpc("save_attachment_rag_index", {
          p_attachment_id: attachmentId,
          p_project_id: projectId,
          p_task_id: taskId,
          p_file_name: fileName,
          p_file_type: parsed.fileType,
          p_extracted_text: parsed.fullText,
          p_chunks: parsed.chunks,
        });
      }
    } catch {
      // Table might not exist yet; in-memory cache will still serve requests
    }

    return { ok: true, chunksCount: parsed.chunks.length, fileType: parsed.fileType };
  } catch (err) {
    console.warn(`[RAG Indexer] Error indexing attachment ${attachmentId}:`, err);
    return { ok: false, error: err };
  }
}

/**
 * Searches concept across attachments (PPTX, DOCX, PDF, XLSX, TXT)
 * and Orbitwork collaborative documents in the given project(s).
 */
export async function searchAttachmentAndDocConcepts({
  supabase,
  projectIds,
  query,
  limit = 8,
}: {
  supabase: SupabaseClient;
  projectIds: string[];
  query: string;
  limit?: number;
}): Promise<MatchedConcept[]> {
  const cleanQ = query.trim();
  if (!cleanQ || projectIds.length === 0) return [];

  const rawWords = cleanQ
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-_]+|[-_]+$/g, ""))
    .filter((w) => w.length >= 2);

  const searchVariants = new Set<string>();
  searchVariants.add(cleanQ.toLowerCase());
  if (rawWords.length >= 2) {
    searchVariants.add(rawWords.join("_"));
    searchVariants.add(rawWords.join("-"));
    searchVariants.add(rawWords.join(""));
    for (let i = 0; i < rawWords.length - 1; i++) {
      searchVariants.add(`${rawWords[i]}_${rawWords[i + 1]}`);
      searchVariants.add(`${rawWords[i]}-${rawWords[i + 1]}`);
      searchVariants.add(`${rawWords[i]}${rawWords[i + 1]}`);
      searchVariants.add(`${rawWords[i]} ${rawWords[i + 1]}`);
    }
  }
  for (const w of rawWords) {
    if (w.length >= 3) searchVariants.add(w);
  }

  const pattern = `%${cleanQ.replace(/[%_\\,()]/g, " ").trim()}%`;
  const results: MatchedConcept[] = [];
  const seenAttachmentIds = new Set<string>();

  // 1. Search persistent RAG index table
  try {
    const variantList = [...searchVariants].slice(0, 8);
    const orClauses = variantList
      .map((v) => `extracted_text.ilike.%${v.replace(/[%_\\,()]/g, "")}%`)
      .join(",");

    let queryBuilder = supabase
      .from("attachment_rag_indexes")
      .select("id, attachment_id, project_id, task_id, file_name, file_type, extracted_text, chunks")
      .in("project_id", projectIds);

    if (orClauses) {
      queryBuilder = queryBuilder.or(orClauses);
    } else {
      queryBuilder = queryBuilder.ilike("extracted_text", pattern);
    }

    const { data: indexedRows } = await queryBuilder.limit(limit);

    if (indexedRows && indexedRows.length > 0) {
      const taskIds = [...new Set(indexedRows.map((r: any) => r.task_id).filter(Boolean))];
      const { data: tasks } = taskIds.length
        ? await supabase.from("tasks").select("id, title, generated_key").in("id", taskIds)
        : { data: [] };
      const taskMap = new Map((tasks ?? []).map((t: any) => [t.id, t]));

      for (const row of indexedRows) {
        seenAttachmentIds.add(row.attachment_id);
        const task = taskMap.get(row.task_id);
        const chunks: DocumentChunk[] = Array.isArray(row.chunks) ? row.chunks : [];

        // Score chunks according to match relevance
        let bestChunk: DocumentChunk | null = null;
        let bestScore = -1;

        for (const c of chunks) {
          const lowerChunk = c.text.toLowerCase();
          let score = 0;
          if (lowerChunk.includes(cleanQ.toLowerCase())) score += 100;
          for (const variant of searchVariants) {
            if (lowerChunk.includes(variant)) {
              score += variant.includes("_") || variant.includes("-") || variant.includes(" ") ? 60 : 20;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestChunk = c;
          }
        }

        const section = bestChunk?.section || "Document Content";
        const snippet = extractMatchingSnippet(
          bestChunk?.text || row.extracted_text,
          cleanQ,
          240
        );

        results.push({
          sourceType: "attachment",
          id: row.attachment_id,
          title: row.file_name,
          projectId: row.project_id,
          taskId: row.task_id,
          taskTitle: task?.title || "Task",
          taskKey: task?.generated_key || "",
          section,
          snippet,
          href: `/projects/${row.project_id}/tasks/${row.task_id}`,
        });
      }
    }
  } catch {
    // Index table not available or empty; proceed to fallback check
  }

  // 2. On-demand fallback & retroactive indexing for unindexed attachments
  if (results.length < limit) {
    try {
      const remainingLimit = limit - results.length;
      const { data: rawAttachments } = await supabase
        .from("task_attachments")
        .select("id, project_id, task_id, file_name, mime_type, file_size_bytes, storage_provider, tasks(id, title, generated_key)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(30);

      for (const att of rawAttachments ?? []) {
        if (seenAttachmentIds.has(att.id)) continue;
        if (results.length >= limit) break;

        const taskObj = Array.isArray(att.tasks) ? att.tasks[0] : att.tasks;
        let cached = memoryExtractCache.get(att.id);

        if (!cached) {
          // Read bytes from attachment_files table
          const { data: fileRow } = await supabase
            .from("attachment_files")
            .select("file_bytes")
            .eq("id", att.id)
            .maybeSingle();

          if (fileRow?.file_bytes) {
            let buffer: Buffer;
            if (typeof fileRow.file_bytes === "string") {
              const hex = fileRow.file_bytes.startsWith("\\x")
                ? fileRow.file_bytes.slice(2)
                : fileRow.file_bytes;
              buffer = Buffer.from(hex, "hex");
            } else {
              buffer = Buffer.from(fileRow.file_bytes);
            }

            const parsed = await extractDocumentText(buffer, att.file_name, att.mime_type);
            if (parsed.fullText) {
              cached = {
                fullText: parsed.fullText,
                chunks: parsed.chunks,
                fileType: parsed.fileType,
              };
              memoryExtractCache.set(att.id, cached);

              // Background persist into attachment_rag_indexes
              try {
                await supabase
                  .from("attachment_rag_indexes")
                  .upsert(
                    {
                      attachment_id: att.id,
                      project_id: att.project_id,
                      task_id: att.task_id,
                      file_name: att.file_name,
                      file_type: parsed.fileType,
                      extracted_text: parsed.fullText,
                      chunks: parsed.chunks,
                      indexed_at: new Date().toISOString(),
                    },
                    { onConflict: "attachment_id" }
                  );
              } catch {
                // Table might not exist yet; in-memory cache will still serve requests
              }
            }
          }
        }

        if (cached && cached.fullText) {
          const lowerText = cached.fullText.toLowerCase();
          const words = cleanQ.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
          const isMatch =
            lowerText.includes(cleanQ.toLowerCase()) ||
            (words.length > 0 && words.every((w) => lowerText.includes(w)));

          if (isMatch) {
            seenAttachmentIds.add(att.id);
            const matchingChunk = cached.chunks.find((c) =>
              c.text.toLowerCase().includes(cleanQ.toLowerCase())
            );
            const section = matchingChunk?.section || "Document Content";
            const snippet = extractMatchingSnippet(
              matchingChunk?.text || cached.fullText,
              cleanQ,
              160
            );

            results.push({
              sourceType: "attachment",
              id: att.id,
              title: att.file_name,
              projectId: att.project_id,
              taskId: att.task_id,
              taskTitle: taskObj?.title || "Task",
              taskKey: taskObj?.generated_key || "",
              section,
              snippet,
              mimeType: att.mime_type,
              fileSizeBytes: att.file_size_bytes,
              href: `/projects/${att.project_id}/tasks/${att.task_id}`,
            });
          }
        }
      }
    } catch (fallbackErr) {
      console.warn("[RAG Indexer] Error in on-demand attachment scan:", fallbackErr);
    }
  }

  // 3. Search Orbitwork Docs & Pages for concept matching
  try {
    const { data: projDocs } = await supabase
      .from("project_documents")
      .select("id, project_id, title, body_markdown, projects(name)")
      .in("project_id", projectIds)
      .or(`title.ilike.${pattern},body_markdown.ilike.${pattern}`)
      .limit(4);

    for (const pd of projDocs ?? []) {
      const cleanBody = (pd.body_markdown || "").replace(/[#*`_~\[\]]/g, " ");
      const snippet = extractMatchingSnippet(cleanBody, cleanQ, 150);
      const projName = (pd.projects as any)?.name || "Project";

      results.push({
        sourceType: "orbitwork_doc",
        id: pd.id,
        title: pd.title,
        projectId: pd.project_id,
        projectName: projName,
        section: "Document Body",
        snippet,
        href: `/projects/${pd.project_id}/documents/${pd.id}`,
      });
    }
  } catch (docErr) {
    console.warn("[RAG Indexer] Error searching project documents:", docErr);
  }

  return results;
}
