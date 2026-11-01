export default function PrintDocument({ projectId, documentId }: { projectId: string; documentId: string }) {
  return <a className="button button-secondary" href={`/api/projects/${projectId}/documents/${documentId}.pdf`}>Download PDF</a>;
}
