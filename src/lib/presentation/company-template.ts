import JSZip from "jszip";
import type { PresentationTemplate, DesignArchetype, TemplateCategory } from "./templates.ts";
import { saveTemplateBuffer, getTemplateBuffer } from "./template-storage";

export interface CompanyTemplateBranding {
  companyName: string;
  copyrightNotice?: string;
  confidentialityNotice?: string;
  logoDetected: boolean;
  footerText?: string;
  disclaimer?: string;
}

export interface CompanyTemplateDefinition {
  templateId: string;
  templateName: string;
  category: TemplateCategory;
  industry: string;
  description: string;
  version: string;
  branding: CompanyTemplateBranding;
  theme: {
    bg: string;
    cardBg: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentSecondary: string;
    fontTitle: string;
    fontBody: string;
    isDark: boolean;
  };
  slidesCount: number;
  slideLayouts: string[];
  supportedSlideTypes: string[];
  rawZipBase64?: string;
  rawZipBuffer?: Uint8Array;
  createdAt: string;
  updatedAt: string;
}

// In-memory registry for uploaded company templates during session / workspace lifetime
const COMPANY_TEMPLATES = new Map<string, CompanyTemplateDefinition>();

// Helper to convert Uint8Array/Buffer to base64 safely
function bufferToBase64(buf: Buffer | Uint8Array): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buf)) {
    return buf.toString("base64");
  }
  const bytes = new Uint8Array(buf);
  // If buffer is very large (>3MB), avoid creating huge base64 strings in memory
  if (bytes.length > 3 * 1024 * 1024) {
    return "";
  }
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize))));
  }
  return typeof btoa !== "undefined" ? btoa(chunks.join("")) : "";
}

function persistToStorage(def: CompanyTemplateDefinition) {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem("orbitwork:custom_templates");
      const list: CompanyTemplateDefinition[] = stored ? JSON.parse(stored) : [];
      // Always strip heavy buffer/base64 so localStorage never exceeds the 5MB quota
      const cleanDef: CompanyTemplateDefinition = {
        ...def,
        rawZipBase64: undefined,
        rawZipBuffer: undefined,
      };
      const updated = [cleanDef, ...list.filter((x) => x.templateId !== def.templateId)].slice(0, 20);
      window.localStorage.setItem("orbitwork:custom_templates", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not persist company template to localStorage:", e);
    }
  }
}

export function loadStoredCompanyTemplates(): CompanyTemplateDefinition[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem("orbitwork:custom_templates");
      if (stored) {
        const list: CompanyTemplateDefinition[] = JSON.parse(stored);
        for (const def of list) {
          if (!COMPANY_TEMPLATES.has(def.templateId)) {
            COMPANY_TEMPLATES.set(def.templateId, def);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load stored templates from localStorage:", e);
    }
  }
  return Array.from(COMPANY_TEMPLATES.values());
}

/**
 * Register a company template directly into memory and storage
 */
export function registerCompanyTemplate(companyDef: CompanyTemplateDefinition): void {
  COMPANY_TEMPLATES.set(companyDef.templateId, companyDef);
  persistToStorage(companyDef);
}

/**
 * Inspect an uploaded PPTX file, extracting theme colors, fonts, slide layouts,
 * and company branding (logos, copyrights, disclaimers, headers/footers) while preserving them intact.
 */
export async function parseAndRegisterCompanyTemplate(
  fileBuffer: Buffer | Uint8Array,
  options: {
    templateName: string;
    companyName?: string;
    category?: TemplateCategory;
    industry?: string;
    version?: string;
  }
): Promise<CompanyTemplateDefinition> {
  const bytes = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);
  const zip = await JSZip.loadAsync(bytes);

  // 1. Inspect slide count and files
  const slideFiles = Object.keys(zip.files).filter((f) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(f)
  );
  const slidesCount = slideFiles.length;

  // 2. Check for embedded images (logos)
  const mediaFiles = Object.keys(zip.files).filter((f) =>
    /^ppt\/media\//i.test(f)
  );
  const logoDetected = mediaFiles.length > 0;

  // 3. Inspect theme XML for colors and fonts
  let bg = "0F172A";
  let cardBg = "1E293B";
  let cardBorder = "334155";
  let textPrimary = "F8FAFC";
  let textSecondary = "94A3B8";
  let accent = "2563EB";
  let accentSecondary = "10B981";
  let fontTitle = "Aptos";
  let fontBody = "Inter";
  let isDark = true;

  const themeFile = zip.file("ppt/theme/theme1.xml");
  if (themeFile) {
    const themeXml = await themeFile.async("string");

    // Extract fonts
    const majorFontMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
    if (majorFontMatch && majorFontMatch[1]) {
      fontTitle = majorFontMatch[1];
    }
    const minorFontMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
    if (minorFontMatch && minorFontMatch[1]) {
      fontBody = minorFontMatch[1];
    }

    // Extract accent color
    const accent1Match = themeXml.match(/<a:accent1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/);
    if (accent1Match && accent1Match[1]) {
      accent = accent1Match[1].toUpperCase();
    }
    const accent2Match = themeXml.match(/<a:accent2>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/);
    if (accent2Match && accent2Match[1]) {
      accentSecondary = accent2Match[1].toUpperCase();
    }

    // Extract dark / light base
    const dk1Match = themeXml.match(/<a:dk1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/);
    const lt1Match = themeXml.match(/<a:lt1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/);
    if (dk1Match && lt1Match) {
      const darkHex = dk1Match[1];
      const lightHex = lt1Match[1];
      if (darkHex === "000000" || darkHex.startsWith("0") || darkHex.startsWith("1")) {
        bg = darkHex.toUpperCase();
        textPrimary = lightHex.toUpperCase();
        isDark = true;
      }
    }
  }

  // 4. Scan slides for text (branding, copyright, legal disclaimer, company name)
  let detectedCompanyName = options.companyName || "";
  let detectedCopyright = "";
  let detectedConfidentiality = "";
  let detectedFooter = "";

  for (const sf of slideFiles.slice(0, 5)) {
    const sFile = zip.file(sf);
    if (!sFile) continue;
    const sXml = await sFile.async("string");

    const textMatches = Array.from(sXml.matchAll(/<a:t>([^<]+)<\/a:t>/g)).map((m) => m[1]);
    for (const t of textMatches) {
      const clean = t.trim();
      if (!clean) continue;

      if (!detectedCompanyName && /^[A-Z0-9\s&.,-]{3,40}$/.test(clean) && !clean.includes("Slide") && !clean.includes("Click")) {
        detectedCompanyName = clean;
      }
      if (/copyright|\(c\)|all rights reserved|©/i.test(clean)) {
        detectedCopyright = clean;
      }
      if (/confidential|proprietary|internal use only|restricted/i.test(clean)) {
        detectedConfidentiality = clean;
      }
      if (clean.length < 50 && (clean.includes("Page") || clean.includes("202") || clean.includes("|"))) {
        detectedFooter = clean;
      }
    }
  }

  const finalCompanyName = options.companyName || detectedCompanyName || "Company Template";
  const templateId = `company_${options.templateName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`;

  const companyDef: CompanyTemplateDefinition = {
    templateId,
    templateName: options.templateName,
    category: (options.category || "custom") as TemplateCategory,
    industry: options.industry || "Enterprise Corporate",
    description: `Official branded template for ${finalCompanyName} (Preserves logos, typography, headers & legal disclaimers intact)`,
    version: options.version || "1.0",
    branding: {
      companyName: finalCompanyName,
      copyrightNotice: detectedCopyright || `© ${new Date().getFullYear()} ${finalCompanyName}. All Rights Reserved.`,
      confidentialityNotice: detectedConfidentiality || "CONFIDENTIAL - PROPRIETARY",
      logoDetected,
      footerText: detectedFooter || `${finalCompanyName} | Confidential`,
    },
    theme: {
      bg,
      cardBg,
      cardBorder,
      textPrimary,
      textSecondary,
      accent,
      accentSecondary,
      fontTitle,
      fontBody,
      isDark,
    },
    slidesCount,
    slideLayouts: ["title", "executive_summary", "metrics_kpi", "status_table", "milestone_timeline", "closing"],
    supportedSlideTypes: ["title", "kpi", "status_graph", "team_workload", "critical_tasks", "cards", "split", "timeline"],
    rawZipBuffer: bytes,
    rawZipBase64: bytes.length <= 3 * 1024 * 1024 ? bufferToBase64(bytes) : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  COMPANY_TEMPLATES.set(templateId, companyDef);
  persistToStorage(companyDef);

  // Persist raw binary buffer to client-side IndexedDB
  await saveTemplateBuffer(templateId, bytes);

  return companyDef;
}

/**
 * Convert a CompanyTemplateDefinition into a PresentationTemplate for Orbitwork deck builders
 */
export function companyTemplateToPresentationTemplate(comp: CompanyTemplateDefinition): PresentationTemplate {
  return {
    id: comp.templateId,
    name: comp.templateName,
    category: "custom",
    archetype: comp.theme.isDark ? "corporate" : "editorial",
    tagline: comp.description,
    bg: comp.theme.bg,
    cardBg: comp.theme.cardBg,
    cardBorder: comp.theme.cardBorder,
    textPrimary: comp.theme.textPrimary,
    textSecondary: comp.theme.textSecondary,
    accent: comp.theme.accent,
    accentSecondary: comp.theme.accentSecondary,
    fontTitle: comp.theme.fontTitle,
    fontBody: comp.theme.fontBody,
    layoutStyle: comp.theme.isDark ? "executive_grid" : "editorial_bold",
    badgeStyle: "sharp",
    transition: "fade",
    isDark: comp.theme.isDark,
    industry: comp.industry,
    recommendedUse: `Company-branded presentation preserving ${comp.branding.companyName} branding, logos, and legal disclaimers`,
    supportedSlideTypes: comp.supportedSlideTypes,
    version: comp.version,
  };
}

/**
 * List all registered company templates
 */
export function getRegisteredCompanyTemplates(): CompanyTemplateDefinition[] {
  if (COMPANY_TEMPLATES.size === 0) {
    loadStoredCompanyTemplates();
  }
  return Array.from(COMPANY_TEMPLATES.values());
}

/**
 * Get a registered company template by ID
 */
export function getCompanyTemplateById(templateId: string): CompanyTemplateDefinition | undefined {
  if (!COMPANY_TEMPLATES.has(templateId)) {
    loadStoredCompanyTemplates();
  }
  return COMPANY_TEMPLATES.get(templateId);
}

/**
 * Retrieve binary template buffer from memory cache, base64, or IndexedDB
 */
export async function getCompanyTemplateBuffer(templateId: string): Promise<Uint8Array | null> {
  const inMem = getCompanyTemplateById(templateId);
  if (inMem?.rawZipBuffer) {
    return inMem.rawZipBuffer;
  }
  if (inMem?.rawZipBase64) {
    try {
      const bytes = typeof Buffer !== "undefined"
        ? Buffer.from(inMem.rawZipBase64, "base64")
        : Uint8Array.from(atob(inMem.rawZipBase64), (c) => c.charCodeAt(0));
      const u8 = new Uint8Array(bytes);
      inMem.rawZipBuffer = u8;
      return u8;
    } catch {
      // Fall through to storage
    }
  }
  const fromStorage = await getTemplateBuffer(templateId);
  if (fromStorage && inMem) {
    inMem.rawZipBuffer = fromStorage;
  }
  return fromStorage;
}
