// src/app/api/public/docs/[slug]/route.ts
import { NextResponse } from "next/server";
import { getPublicDoc } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const publicDoc = await getPublicDoc(slug);

    if (!publicDoc) {
      return NextResponse.json({ error: "Document not found or not published" }, { status: 404 });
    }

    return NextResponse.json(publicDoc);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
