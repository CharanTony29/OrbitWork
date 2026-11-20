// src/lib/presentation/templates.ts
// Orbitwork Professional Presentation Template Registry (40+ Curated Styles)

export type TemplateCategory =
  | "all"
  | "executive"
  | "strategy"
  | "project"
  | "tech"
  | "product"
  | "sales"
  | "marketing"
  | "finance"
  | "consulting"
  | "engineering"
  | "hr"
  | "operations"
  | "compliance"
  | "data"
  | "creative"
  | "custom";

export type DesignArchetype =
  | "editorial"        // Magazine-style asymmetric, high whitespace, giant typography, quote callouts
  | "corporate"        // Institutional boardroom, formal top/bottom framing, 4-pillar scorecard, risk ledger
  | "modern_saas"      // Bento-box layout, floating pods, glowing trend pills, product UI styling
  | "data_story"       // 70% canvas chart dominance, telemetry side rail, DoD delta chips, anomaly feeds
  | "consulting"       // Minto pyramid action title, 3 vertical strategic pillars, 2x2 framework, recommendation table
  | "minimalist"       // Swiss/Bauhaus stark typography (48pt+), extreme whitespace, giant 78% focal number
  | "creative_layered"; // Asymmetric color blocks, layered frames, hero status card hierarchy

export interface PresentationTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  archetype: DesignArchetype;
  tagline: string;
  bg: string;              // Slide canvas background (hex without #)
  cardBg: string;          // Card / surface background (hex without #)
  cardBorder: string;      // Card border stroke (hex without #)
  textPrimary: string;     // Primary title text (hex without #)
  textSecondary: string;   // Secondary / muted body text (hex without #)
  accent: string;          // Primary metric accent / highlight (hex without #)
  accentSecondary: string; // Target / benchmark / secondary accent (hex without #)
  fontTitle: string;       // Display / heading font
  fontBody: string;        // Body & tabular font
  layoutStyle: "asymmetric_split" | "executive_grid" | "bento_clean" | "editorial_bold";
  badgeStyle: "pill" | "rounded" | "sharp";
  transition: "fade" | "push" | "wipe" | "none";
  isDark: boolean;
  industry?: string;
  recommendedUse?: string;
  visualStyle?: string;
  supportedSlideTypes?: string[];
  version?: string;
}

const BASE_PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  // ==========================================
  // 0. CANONICAL ORBITWORK REVIEW MASTER TEMPLATE
  // ==========================================
  {
    id: "orbitwork_workload_review",
    name: "Orbitwork Project & Workload Review (Master)",
    category: "project",
    archetype: "corporate",
    tagline: "Official 10-slide executive review: project health, effort-based capacity, delivery risk & team planning",
    bg: "FFFFFF",
    cardBg: "F8FAFC",
    cardBorder: "E2E8F0",
    textPrimary: "0F172A",
    textSecondary: "475569",
    accent: "2563EB",
    accentSecondary: "10B981",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "executive_grid",
    badgeStyle: "pill",
    transition: "fade",
    isDark: false,
    industry: "Enterprise Project & Workload Management",
    recommendedUse: "Leadership project reviews, sprint health, effort-based workload & delivery planning",
  },
  // ==========================================
  // 1. EXECUTIVE & BOARDROOM
  // ==========================================
  {
    id: "pitch_sage",
    name: "Pitch Editorial Sage",
    category: "executive",
    archetype: "editorial",
    tagline: "Minimalist executive editorial with sage canvas & jet black cards",
    bg: "8FA173",
    cardBg: "7E9162",
    cardBorder: "6F8254",
    textPrimary: "FFFFFF",
    textSecondary: "111111",
    accent: "111111",
    accentSecondary: "FFFFFF",
    fontTitle: "Manrope",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: false,
  },
  {
    id: "obsidian_executive",
    name: "Obsidian Glassmorphic",
    category: "executive",
    archetype: "corporate",
    tagline: "High-contrast dark glass boardroom aesthetic with electric blue",
    bg: "0B0F19",
    cardBg: "131D31",
    cardBorder: "1E2E4E",
    textPrimary: "F8FAFC",
    textSecondary: "94A3B8",
    accent: "38BDF8",
    accentSecondary: "818CF8",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "executive_grid",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "fortune_boardroom",
    name: "Fortune 500 Boardroom",
    category: "executive",
    archetype: "corporate",
    tagline: "Classic deep midnight navy with corporate warm gold accents",
    bg: "0A192F",
    cardBg: "112240",
    cardBorder: "233554",
    textPrimary: "CCD6F6",
    textSecondary: "8892B0",
    accent: "F5A623",
    accentSecondary: "64FFDA",
    fontTitle: "Aptos",
    fontBody: "Calibri",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "push",
    isDark: true,
  },
  {
    id: "goldman_financial",
    name: "Goldman Financial Ledger",
    category: "executive",
    archetype: "corporate",
    tagline: "Sleek institutional slate with copper and amber highlights",
    bg: "1A2530",
    cardBg: "243342",
    cardBorder: "34495E",
    textPrimary: "ECF0F1",
    textSecondary: "BDC3C7",
    accent: "E67E22",
    accentSecondary: "1ABC9C",
    fontTitle: "Georgia",
    fontBody: "Arial",
    layoutStyle: "asymmetric_split",
    badgeStyle: "sharp",
    transition: "fade",
    isDark: true,
  },
  {
    id: "swiss_monochrome",
    name: "Swiss International Typographic",
    category: "executive",
    archetype: "minimalist",
    tagline: "Legendary modernist grid, stark contrast, vermillion accent",
    bg: "F5F5F7",
    cardBg: "FFFFFF",
    cardBorder: "E5E5E7",
    textPrimary: "1D1D1F",
    textSecondary: "6E6E73",
    accent: "FF3300",
    accentSecondary: "000000",
    fontTitle: "Helvetica",
    fontBody: "Helvetica",
    layoutStyle: "editorial_bold",
    badgeStyle: "sharp",
    transition: "wipe",
    isDark: false,
  },
  {
    id: "imperial_navy",
    name: "Imperial Executive Blue",
    category: "executive",
    archetype: "corporate",
    tagline: "Authoritative deep royal blue with crisp white card containers",
    bg: "0C2340",
    cardBg: "153765",
    cardBorder: "204A85",
    textPrimary: "FFFFFF",
    textSecondary: "CAD5E2",
    accent: "00B4D8",
    accentSecondary: "90E0EF",
    fontTitle: "Montserrat",
    fontBody: "Calibri",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "charcoal_minimal",
    name: "Charcoal Executive Suite",
    category: "executive",
    archetype: "minimalist",
    tagline: "Matte charcoal surfaces with subtle bronze and cream lettering",
    bg: "1E1E24",
    cardBg: "2B2D37",
    cardBorder: "3C3F4D",
    textPrimary: "FFF8F0",
    textSecondary: "BDBBB0",
    accent: "D4AF37",
    accentSecondary: "E29578",
    fontTitle: "Aptos",
    fontBody: "Arial",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "push",
    isDark: true,
  },
  {
    id: "monaco_yacht",
    name: "Monaco Mediterranean",
    category: "executive",
    archetype: "editorial",
    tagline: "High-net-worth nautical navy with champagne gold details",
    bg: "051923",
    cardBg: "003554",
    cardBorder: "006494",
    textPrimary: "FFFFFF",
    textSecondary: "8ED1FC",
    accent: "E0AA3E",
    accentSecondary: "0582CA",
    fontTitle: "Playfair Display",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },

  // ==========================================
  // 2. MODERN TECH & SAAS
  // ==========================================
  {
    id: "linear_dark",
    name: "Linear Precision Dark",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Silicon Valley developer tool dark mode with neon purple tint",
    bg: "08090A",
    cardBg: "121417",
    cardBorder: "22262B",
    textPrimary: "F7F8F8",
    textSecondary: "8A8F98",
    accent: "5E6AD2",
    accentSecondary: "4EA8DE",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "bento_clean",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "stripe_indigo",
    name: "Stripe Hyper-Tech",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Vibrant global payment infrastructure indigo with cyan highlights",
    bg: "0A2540",
    cardBg: "103254",
    cardBorder: "1A436D",
    textPrimary: "FFFFFF",
    textSecondary: "ADBDCC",
    accent: "635BFF",
    accentSecondary: "00D4FF",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "vercel_monochrome",
    name: "Vercel Stark Monochrome",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Pure black canvas, hairline grey boundaries, electric blue pulse",
    bg: "000000",
    cardBg: "111111",
    cardBorder: "2E2E2E",
    textPrimary: "EDEDED",
    textSecondary: "888888",
    accent: "0070F3",
    accentSecondary: "50E3C2",
    fontTitle: "Geist",
    fontBody: "Inter",
    layoutStyle: "bento_clean",
    badgeStyle: "sharp",
    transition: "wipe",
    isDark: true,
  },
  {
    id: "github_dimmed",
    name: "GitHub Octo Dimmed",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Dark dimmed code hub aesthetic with open-source green and sky blue",
    bg: "1C2128",
    cardBg: "2D333B",
    cardBorder: "444C56",
    textPrimary: "CDD9E5",
    textSecondary: "768390",
    accent: "539BF5",
    accentSecondary: "57AB5A",
    fontTitle: "Trebuchet MS",
    fontBody: "Calibri",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "push",
    isDark: true,
  },
  {
    id: "cyberpunk_neon",
    name: "Cyberpunk Horizon",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Ultra-futuristic synthwave violet with fluorescent pink and cyan",
    bg: "0D0221",
    cardBg: "19053B",
    cardBorder: "2E0854",
    textPrimary: "F8F9FA",
    textSecondary: "C77DFF",
    accent: "FF007F",
    accentSecondary: "00F0FF",
    fontTitle: "Space Grotesk",
    fontBody: "Inter",
    layoutStyle: "editorial_bold",
    badgeStyle: "sharp",
    transition: "fade",
    isDark: true,
  },
  {
    id: "databricks_fire",
    name: "Databricks Lakehouse",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Modern enterprise data platform with flame orange and obsidian",
    bg: "1B1B1D",
    cardBg: "27272A",
    cardBorder: "3F3F46",
    textPrimary: "FAFAFA",
    textSecondary: "A1A1AA",
    accent: "FF3621",
    accentSecondary: "FF9E00",
    fontTitle: "Montserrat",
    fontBody: "Arial",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "snowflake_arctic",
    name: "Snowflake Arctic Cloud",
    category: "tech",
    archetype: "modern_saas",
    tagline: "Cool glacial cyan and deep navy inspired by modern data cloud",
    bg: "071B2F",
    cardBg: "0E2A47",
    cardBorder: "16426C",
    textPrimary: "FFFFFF",
    textSecondary: "A5C4E0",
    accent: "29B5E8",
    accentSecondary: "7EE081",
    fontTitle: "Segoe UI",
    fontBody: "Calibri",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "push",
    isDark: true,
  },
  {
    id: "notion_clean",
    name: "Notion Editorial Clean",
    category: "tech",
    archetype: "minimalist",
    tagline: "Cream white document aesthetic with warm charcoal borders",
    bg: "FFFDF9",
    cardBg: "FFFFFF",
    cardBorder: "EFECE6",
    textPrimary: "37352F",
    textSecondary: "787774",
    accent: "0A85EA",
    accentSecondary: "EA4335",
    fontTitle: "Georgia",
    fontBody: "Arial",
    layoutStyle: "bento_clean",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: false,
  },

  // ==========================================
  // 3. STRATEGY & CONSULTING
  // ==========================================
  {
    id: "mckinsey_advisory",
    name: "McKinsey Strategic Framework",
    category: "consulting",
    archetype: "consulting",
    tagline: "Elite global advisory deep navy with crisp cobalt accents",
    bg: "00205B",
    cardBg: "00338D",
    cardBorder: "004A99",
    textPrimary: "FFFFFF",
    textSecondary: "BDD6EE",
    accent: "00A3E0",
    accentSecondary: "F1C40F",
    fontTitle: "Aptos",
    fontBody: "Arial",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "bain_clean",
    name: "Bain Pure Executive",
    category: "consulting",
    archetype: "consulting",
    tagline: "Ultra-clean boardroom presentation with signature crimson accents",
    bg: "FFFFFF",
    cardBg: "F8F9FA",
    cardBorder: "E9ECEF",
    textPrimary: "212529",
    textSecondary: "6C757D",
    accent: "CC0000",
    accentSecondary: "0056B3",
    fontTitle: "Helvetica",
    fontBody: "Arial",
    layoutStyle: "executive_grid",
    badgeStyle: "sharp",
    transition: "wipe",
    isDark: false,
  },
  {
    id: "bcg_emerald",
    name: "BCG Growth Emerald",
    category: "consulting",
    archetype: "consulting",
    tagline: "Prestigious corporate forest green with mint and champagne highlights",
    bg: "00382B",
    cardBg: "004D3C",
    cardBorder: "006B54",
    textPrimary: "FFFFFF",
    textSecondary: "C2E0D8",
    accent: "00A86B",
    accentSecondary: "E2C974",
    fontTitle: "Montserrat",
    fontBody: "Calibri",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "deloitte_green",
    name: "Deloitte Global Advisory",
    category: "consulting",
    archetype: "consulting",
    tagline: "Signature black and green dot corporate identity for enterprise audits",
    bg: "000000",
    cardBg: "1A1A1A",
    cardBorder: "333333",
    textPrimary: "FFFFFF",
    textSecondary: "A0A0A0",
    accent: "86BC25",
    accentSecondary: "00A3E0",
    fontTitle: "Arial",
    fontBody: "Arial",
    layoutStyle: "executive_grid",
    badgeStyle: "pill",
    transition: "push",
    isDark: true,
  },
  {
    id: "pwc_tangerine",
    name: "PwC Enterprise Matrix",
    category: "consulting",
    archetype: "consulting",
    tagline: "Dynamic corporate charcoal with warm energetic orange badges",
    bg: "2D2D2D",
    cardBg: "3D3D3D",
    cardBorder: "525252",
    textPrimary: "FFFFFF",
    textSecondary: "D4D4D4",
    accent: "D04A02",
    accentSecondary: "EB8C00",
    fontTitle: "Georgia",
    fontBody: "Arial",
    layoutStyle: "bento_clean",
    badgeStyle: "sharp",
    transition: "fade",
    isDark: true,
  },
  {
    id: "kpmg_royal",
    name: "KPMG Blue Horizon",
    category: "consulting",
    archetype: "consulting",
    tagline: "Trusted institutional royal blue with icy high-contrast data bars",
    bg: "00338D",
    cardBg: "005EB8",
    cardBorder: "0076D7",
    textPrimary: "FFFFFF",
    textSecondary: "D8E7F5",
    accent: "0091DA",
    accentSecondary: "48D597",
    fontTitle: "Calibri",
    fontBody: "Calibri",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "gartner_magic",
    name: "Gartner Quadrant Executive",
    category: "consulting",
    archetype: "consulting",
    tagline: "Industry research standard with authoritative slate navy & amber",
    bg: "002856",
    cardBg: "0B3870",
    cardBorder: "164C8E",
    textPrimary: "FFFFFF",
    textSecondary: "B6D0ED",
    accent: "EAAA00",
    accentSecondary: "00A3E0",
    fontTitle: "Segoe UI",
    fontBody: "Segoe UI",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "push",
    isDark: true,
  },
  {
    id: "accenture_violet",
    name: "Accenture Innovation Violet",
    category: "consulting",
    archetype: "consulting",
    tagline: "Modern digital transformation deep violet with purple beacon",
    bg: "120D1C",
    cardBg: "1F1730",
    cardBorder: "33264D",
    textPrimary: "FAF5FF",
    textSecondary: "D8B4FE",
    accent: "A100FF",
    accentSecondary: "38BDF8",
    fontTitle: "Montserrat",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },

  // ==========================================
  // 4. CREATIVE, NATURE & EDITORIAL
  // ==========================================
  {
    id: "nordic_spruce",
    name: "Nordic Forest & Moss",
    category: "creative",
    archetype: "editorial",
    tagline: "Peaceful Scandinavian pine and lichen greens with warm wood tones",
    bg: "1C2822",
    cardBg: "273830",
    cardBorder: "394F45",
    textPrimary: "F2F5F3",
    textSecondary: "A7BDAE",
    accent: "52B788",
    accentSecondary: "D8F3DC",
    fontTitle: "Aptos",
    fontBody: "Arial",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "japanese_zen",
    name: "Japanese Zen Minimalist",
    category: "creative",
    archetype: "minimalist",
    tagline: "Wabi-sabi balance: warm off-white, sumi ink, and Japanese vermillion",
    bg: "EFECE6",
    cardBg: "FFFFFF",
    cardBorder: "DFDBD2",
    textPrimary: "242426",
    textSecondary: "666564",
    accent: "C0392B",
    accentSecondary: "27AE60",
    fontTitle: "Georgia",
    fontBody: "Inter",
    layoutStyle: "editorial_bold",
    badgeStyle: "sharp",
    transition: "wipe",
    isDark: false,
  },
  {
    id: "terracotta_warm",
    name: "Tuscan Warm Terracotta",
    category: "creative",
    archetype: "creative_layered",
    tagline: "Earthy baked clay, Mediterranean olive, and warm cream surfaces",
    bg: "231815",
    cardBg: "352520",
    cardBorder: "4E3832",
    textPrimary: "FDF6F0",
    textSecondary: "D4C1B8",
    accent: "E07A5F",
    accentSecondary: "81B29A",
    fontTitle: "Playfair Display",
    fontBody: "Calibri",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "sunset_coral",
    name: "California Sunset Coral",
    category: "creative",
    archetype: "creative_layered",
    tagline: "Warm Pacific dusk: deep twilight plum with vivid sunset coral",
    bg: "1F162B",
    cardBg: "302242",
    cardBorder: "4B3666",
    textPrimary: "FFF1F2",
    textSecondary: "E9D5FF",
    accent: "F43F5E",
    accentSecondary: "F59E0B",
    fontTitle: "Montserrat",
    fontBody: "Inter",
    layoutStyle: "bento_clean",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
  {
    id: "bauhaus_primary",
    name: "Bauhaus Modernist Grid",
    category: "creative",
    archetype: "creative_layered",
    tagline: "Iconic primary color accents on neutral structured concrete grid",
    bg: "F0F0F2",
    cardBg: "FFFFFF",
    cardBorder: "D6D6DC",
    textPrimary: "141416",
    textSecondary: "585860",
    accent: "004CE8",
    accentSecondary: "E81B23",
    fontTitle: "Helvetica",
    fontBody: "Helvetica",
    layoutStyle: "editorial_bold",
    badgeStyle: "sharp",
    transition: "push",
    isDark: false,
  },
  {
    id: "lavender_dream",
    name: "Soft Amethyst & Lavender",
    category: "creative",
    archetype: "creative_layered",
    tagline: "Gentle modern pastel purple with crisp dark plum typography",
    bg: "F7F4FA",
    cardBg: "FFFFFF",
    cardBorder: "E7DFF0",
    textPrimary: "2C1844",
    textSecondary: "64537A",
    accent: "7E22CE",
    accentSecondary: "EC4899",
    fontTitle: "Manrope",
    fontBody: "Inter",
    layoutStyle: "bento_clean",
    badgeStyle: "pill",
    transition: "fade",
    isDark: false,
  },
  {
    id: "coastal_ocean",
    name: "Pacific Deep Coastal",
    category: "creative",
    archetype: "editorial",
    tagline: "Abyssal ocean depths with bioluminescent turquoise and seafoam",
    bg: "081C24",
    cardBg: "0E2E3B",
    cardBorder: "16485B",
    textPrimary: "E0F2FE",
    textSecondary: "7DD3FC",
    accent: "06B6D4",
    accentSecondary: "34D399",
    fontTitle: "Montserrat",
    fontBody: "Calibri",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "matcha_latte",
    name: "Kyoto Matcha Cream",
    category: "creative",
    archetype: "editorial",
    tagline: "Warm Japanese green tea tones on smooth unbleached linen",
    bg: "F3F4EE",
    cardBg: "FFFFFF",
    cardBorder: "E1E3D5",
    textPrimary: "243026",
    textSecondary: "5D6B60",
    accent: "4D7C0F",
    accentSecondary: "CA8A04",
    fontTitle: "Manrope",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: false,
  },

  // ==========================================
  // 5. DATA, METRICS & ANALYTICS HEAVY
  // ==========================================
  {
    id: "bloomberg_terminal",
    name: "Bloomberg Terminal",
    category: "data",
    archetype: "data_story",
    tagline: "Legendary financial trading desk black canvas with amber phosphor",
    bg: "000000",
    cardBg: "121212",
    cardBorder: "2A2A2A",
    textPrimary: "FF9900",
    textSecondary: "B0B0B0",
    accent: "FF9900",
    accentSecondary: "00FF66",
    fontTitle: "Courier New",
    fontBody: "Courier New",
    layoutStyle: "bento_clean",
    badgeStyle: "sharp",
    transition: "none",
    isDark: true,
  },
  {
    id: "datadog_observability",
    name: "Datadog Telemetry",
    category: "data",
    archetype: "data_story",
    tagline: "High-density cloud infrastructure observability purple and signal teal",
    bg: "12101F",
    cardBg: "1F1B33",
    cardBorder: "322C52",
    textPrimary: "FFFFFF",
    textSecondary: "AFA9D4",
    accent: "7C3AED",
    accentSecondary: "10B981",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "bento_clean",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "grafana_metrics",
    name: "Grafana Dark Dashboard",
    category: "data",
    archetype: "data_story",
    tagline: "Operational command center charcoal with vibrant status signals",
    bg: "181B1F",
    cardBg: "22252B",
    cardBorder: "363A45",
    textPrimary: "ECEFF4",
    textSecondary: "98A2B3",
    accent: "38BDF8",
    accentSecondary: "F59E0B",
    fontTitle: "Segoe UI",
    fontBody: "Segoe UI",
    layoutStyle: "asymmetric_split",
    badgeStyle: "rounded",
    transition: "fade",
    isDark: true,
  },
  {
    id: "tableau_analytics",
    name: "Tableau Visual Analytics",
    category: "data",
    archetype: "data_story",
    tagline: "Crisp white business intelligence reporting with classic navy & coral",
    bg: "FFFFFF",
    cardBg: "F7FAFC",
    cardBorder: "E2E8F0",
    textPrimary: "1A202C",
    textSecondary: "4A5568",
    accent: "2B6CB0",
    accentSecondary: "ED8936",
    fontTitle: "Trebuchet MS",
    fontBody: "Calibri",
    layoutStyle: "executive_grid",
    badgeStyle: "rounded",
    transition: "push",
    isDark: false,
  },
  {
    id: "executive_light_print",
    name: "Executive Formal Print / PDF",
    category: "data",
    archetype: "corporate",
    tagline: "Paper-white layout optimized for boardroom printing, binders & PDFs",
    bg: "FFFFFF",
    cardBg: "FAFAFA",
    cardBorder: "E4E4E7",
    textPrimary: "09090B",
    textSecondary: "52525B",
    accent: "0284C7",
    accentSecondary: "16A34A",
    fontTitle: "Aptos",
    fontBody: "Arial",
    layoutStyle: "editorial_bold",
    badgeStyle: "sharp",
    transition: "none",
    isDark: false,
  },

  // ==========================================
  // 6. CUSTOM & BRAND
  // ==========================================
  {
    id: "custom_brand",
    name: "Custom RGB Brand Suite",
    category: "custom",
    archetype: "modern_saas",
    tagline: "Create your own corporate template with custom RGB pickers & AI styling",
    bg: "0F172A",
    cardBg: "1E293B",
    cardBorder: "334155",
    textPrimary: "FFFFFF",
    textSecondary: "94A3B8",
    accent: "2563EB",
    accentSecondary: "10B981",
    fontTitle: "Inter",
    fontBody: "Inter",
    layoutStyle: "asymmetric_split",
    badgeStyle: "pill",
    transition: "fade",
    isDark: true,
  },
];

import { CORPORATE_CATALOG } from "./corporate-catalog.ts";
import {
  getCompanyTemplateById,
  companyTemplateToPresentationTemplate,
} from "./company-template.ts";

/**
 * Full Orbitwork Enterprise Presentation Template Library (260+ Curated Templates)
 */
export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  ...BASE_PRESENTATION_TEMPLATES,
  ...CORPORATE_CATALOG,
];

export function getTemplateById(templateId?: string): PresentationTemplate {
  if (!templateId) return PRESENTATION_TEMPLATES[0]; // Pitch Sage default
  const found = PRESENTATION_TEMPLATES.find((t) => t.id === templateId);
  if (found) return found;

  const companyTmpl = getCompanyTemplateById(templateId);
  if (companyTmpl) {
    return companyTemplateToPresentationTemplate(companyTmpl);
  }

  return PRESENTATION_TEMPLATES[0];
}

export function getTemplatesByCategory(category: TemplateCategory): PresentationTemplate[] {
  if (category === "all") return PRESENTATION_TEMPLATES;
  return PRESENTATION_TEMPLATES.filter((t) => t.category === category);
}

export function searchTemplates(query: string, category?: TemplateCategory): PresentationTemplate[] {
  const q = query.toLowerCase().trim();
  return PRESENTATION_TEMPLATES.filter((t) => {
    const matchesCat = !category || category === "all" || t.category === category;
    if (!matchesCat) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.industry?.toLowerCase().includes(q) ||
      t.recommendedUse?.toLowerCase().includes(q) ||
      t.archetype.toLowerCase().includes(q)
    );
  });
}

export function getArchetype(template?: PresentationTemplate): DesignArchetype {
  return template?.archetype || "corporate";
}

export interface ArchetypeDesignSystem {
  id: DesignArchetype;
  label: string;
  description: string;
  coverStyle: string;
  kpiStyle: string;
  statusStyle: string;
  workloadStyle: string;
  criticalStyle: string;
}

export const ARCHETYPE_SYSTEMS: Record<DesignArchetype, ArchetypeDesignSystem> = {
  editorial: {
    id: "editorial",
    label: "Editorial & Magazine",
    description: "Asymmetric split layout, 40pt+ headline typography, large whitespace, quote-style executive takeaways",
    coverStyle: "Split canvas with vertical accent block, multi-line bold title, minimalist timeframe capsule",
    kpiStyle: "40% Executive Insight narrative card on left + 2 large accented metric blocks on right",
    statusStyle: "Horizontal narrative rows with progress bars and magazine styling",
    workloadStyle: "Spacious contributor cards with capacity indicators",
    criticalStyle: "Quote-style executive alert callout with streamlined priority list"
  },
  corporate: {
    id: "corporate",
    label: "Corporate Executive & Boardroom",
    description: "Formal institutional framing, 4-pillar scorecard, 2x2 executive matrix, governance risk ledger",
    coverStyle: "Institutional top/bottom framing rules, formal governance header, metadata ledger table",
    kpiStyle: "4-Pillar Executive Scorecard (Scope, % Complete, In Flight, Overdue) + Velocity chart below",
    statusStyle: "2x2 Executive Governance Matrix (Completed vs Active, On Hold vs Pending)",
    workloadStyle: "Structured institutional tabular audit ledger with allocation indices",
    criticalStyle: "Formal Risk Mitigation Ledger with severity rankings P1/P2/P3 and action owners"
  },
  modern_saas: {
    id: "modern_saas",
    label: "Modern Tech & SaaS Bento Grid",
    description: "Bento-box grid pods, floating rounded cards, glowing trend pills, dark mode terminal chips",
    coverStyle: "Hero tech launch deck with glowing version tag (v2.4), gradient title, floating metadata pods",
    kpiStyle: "2x2 Asymmetric Bento Grid: Hero KPI pod with glowing trend pill, velocity chart, sprint meters",
    statusStyle: "Bento status cluster pods with colored status dots, glow borders, and dynamic completion tracks",
    workloadStyle: "Sprint pod cards with avatar initials badge, active task counts, and velocity meters",
    criticalStyle: "Incident console & blocker feed with terminal chips and P0/P1 severity badges"
  },
  data_story: {
    id: "data_story",
    label: "Data Storytelling & Telemetry",
    description: "70% slide chart dominance, dense telemetry side rail, DoD delta annotations, anomaly feed",
    coverStyle: "Live telemetry dashboard header, system status indicator (STATUS: OPTIMAL), monospace tags",
    kpiStyle: "70% Full-slide data visualization canvas + right-hand telemetry rail with delta readings",
    statusStyle: "High-density telemetry distribution stream with exact counts, percentage shares, and flow tables",
    workloadStyle: "Throughput & resource capacity telemetry meters with bottleneck indicators",
    criticalStyle: "Anomaly detection telemetry log with deviation threshold warnings and root-cause flags"
  },
  consulting: {
    id: "consulting",
    label: "Strategic Consulting & Advisory",
    description: "Minto Pyramid Action titles, 3 vertical strategic pillars, 2x2 strategic framework, recommendation table",
    coverStyle: "Formal client/engagement header band, strategic title with subtitle rule, 3-part engagement summary",
    kpiStyle: "Minto 3-Pillar Framework: Lead Action title + 3 vertical strategic pillars (Velocity, Quality, Health)",
    statusStyle: "Strategic 2x2 Execution Maturity Framework with quadrant positioning",
    workloadStyle: "Strategic Resource Allocation Matrix with capacity utilization scoring",
    criticalStyle: "Observation -> Strategic Implication -> Recommended Action 3-column recommendation framework"
  },
  minimalist: {
    id: "minimalist",
    label: "Swiss International Minimalist",
    description: "Massive Bauhaus typography (48pt+), extreme whitespace, giant 78% focal number, hairline rules",
    coverStyle: "International Typographic Style: stark 48pt title, single hairline dividing rule, pure negative space",
    kpiStyle: "One Major Message: Giant 72pt focal number (78%) on center-left + 2 clean sub-metrics, zero card clutter",
    statusStyle: "4 clean typographic columns separated by thin vertical hairline dividers, zero heavy cards",
    workloadStyle: "Typographic contributor index with clean dot leaders and delivery stats",
    criticalStyle: "Stark minimalist focus list with high-contrast urgent markers and generous breathing room"
  },
  creative_layered: {
    id: "creative_layered",
    label: "Creative Layered & Asymmetric",
    description: "Asymmetric color blocking, overlapping layered frames, hero status card hierarchy, artistic badges",
    coverStyle: "Asymmetric geometric color blocks, overlapping card accents, expressive offset project title",
    kpiStyle: "Asymmetric staggered metric pods of varying dimensions with layered accent blocks",
    statusStyle: "Hero status card (50% slide width) for dominant workflow state + side stacked status cards",
    workloadStyle: "Creative contributor showcase with artistic badge tags and visual flair",
    criticalStyle: "Visual sticky attention board with creative priority pins and highlighted callouts"
  }
};
