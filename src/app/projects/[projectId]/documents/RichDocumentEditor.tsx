"use client";

import { useRef } from "react";

type Props = { action: (data: FormData) => void | Promise<void>; projectId: string; documentId: string; title: string; body: string };

export default function RichDocumentEditor({ action, projectId, documentId, title, body }: Props) {
  const editor = useRef<HTMLTextAreaElement>(null);
  function insert(before: string, after = "") {
    const node = editor.current; if (!node) return;
    const start = node.selectionStart; const end = node.selectionEnd; const value = node.value;
    node.setRangeText(`${before}${value.slice(start, end) || "text"}${after}`, start, end, "select"); node.focus();
  }
  function insertImage(dataUrl: string) {
    const node = editor.current; if (!node) return;
    const start = node.selectionStart; node.setRangeText(`![Pasted image](${dataUrl})`, start, node.selectionEnd, "end"); node.focus();
  }
  return <form action={action} className="document-editor-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="documentId" value={documentId}/><label>Title<input name="title" defaultValue={title} maxLength={200} required/></label><div className="document-toolbar" aria-label="Document formatting"><button type="button" onClick={() => insert("# ", "")}>Heading 1</button><button type="button" onClick={() => insert("## ", "")}>Heading 2</button><button type="button" onClick={() => insert("**", "**")}><strong>B</strong></button><button type="button" onClick={() => insert("*", "*")}><em>I</em></button><button type="button" onClick={() => insert("- ", "")}>• List</button><button type="button" onClick={() => insert("1. ", "")}>1. List</button><label className="document-image-button">Add image<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size <= 350_000) { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" && insertImage(reader.result); reader.readAsDataURL(file); } event.currentTarget.value = ""; }}/></label></div><label>Document content<textarea ref={editor} name="body" defaultValue={body} maxLength={500000} rows={24} placeholder="Write your project notes here…" onPaste={(event) => { const image = [...event.clipboardData.items].find((item) => item.type.startsWith("image/")); const file = image?.getAsFile(); if (file) { event.preventDefault(); if (file.size <= 350_000) { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" && insertImage(reader.result); reader.readAsDataURL(file); } } }}/></label><p className="document-editor-hint">Use the toolbar for headings, bold, italic, and lists. Paste or add an image (up to 350 KB). Save changes to publish them.</p><button className="button button-primary">Save document</button></form>;
}
