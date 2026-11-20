import { NextResponse } from "next/server";
import {
  getRegisteredCompanyTemplates,
  registerCompanyTemplate,
  companyTemplateToPresentationTemplate,
  parseAndRegisterCompanyTemplate,
  CompanyTemplateDefinition,
} from "@/lib/presentation/company-template";

export async function GET() {
  try {
    const list = getRegisteredCompanyTemplates();
    return NextResponse.json({
      templates: list.map(companyTemplateToPresentationTemplate),
      definitions: list,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.definition) {
      const def = body.definition as CompanyTemplateDefinition;
      const cleanDef: CompanyTemplateDefinition = {
        ...def,
        rawZipBase64: undefined,
        rawZipBuffer: undefined,
      };
      registerCompanyTemplate(cleanDef);
      return NextResponse.json({
        success: true,
        template: companyTemplateToPresentationTemplate(cleanDef),
        definition: cleanDef,
      });
    }

    if (body.rawZipBase64 && body.templateName) {
      const buf = Buffer.from(body.rawZipBase64, "base64");
      const def = await parseAndRegisterCompanyTemplate(buf, {
        templateName: body.templateName,
        companyName: body.companyName || body.templateName,
      });
      return NextResponse.json({
        success: true,
        template: companyTemplateToPresentationTemplate(def),
        definition: def,
      });
    }

    return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to register template" }, { status: 500 });
  }
}
