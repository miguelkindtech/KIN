import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanExtractedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = cleanExtractedText(parsed.text || "");
    const pages = parsed.pages
      .map((page) => cleanExtractedText(page.text || ""))
      .filter(Boolean);

    if (!text) {
      return Response.json(
        { error: "This PDF did not return readable text." },
        { status: 422 }
      );
    }

    return Response.json({
      text,
      suggestedTitle: file.name.replace(/\.pdf$/i, "").trim(),
      pages,
      pageCount: parsed.total || pages.length || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import PDF.";
    return Response.json({ error: message }, { status: 500 });
  }
}
