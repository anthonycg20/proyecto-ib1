import type { FinancialData } from "./finance";

type ImportedField = {
  key: keyof FinancialData;
  label: string;
  aliases: string[];
  excludes?: string[];
};

export type DocumentImportResult = {
  values: Partial<FinancialData>;
  detected: { key: keyof FinancialData; label: string; value: number }[];
  metadata: {
    company?: string;
    cuit?: string;
    period?: string;
    documentType: string;
  };
  coverage: number;
  findings: string[];
  warnings: string[];
};

const importedFields: ImportedField[] = [
  { key: "nonCurrentAssets", label: "Activo no corriente", aliases: ["activo no corriente", "activo no circulante"] },
  { key: "currentAssets", label: "Activo corriente", aliases: ["activo corriente", "activo circulante"], excludes: ["no corriente", "no circulante"] },
  { key: "nonCurrentLiabilities", label: "Pasivo no corriente", aliases: ["pasivo no corriente", "pasivo no circulante"] },
  { key: "currentLiabilities", label: "Pasivo corriente", aliases: ["pasivo corriente", "pasivo circulante"], excludes: ["no corriente", "no circulante"] },
  { key: "revenue", label: "Ventas e ingresos", aliases: ["ventas e ingresos", "ingresos por ventas", "ventas netas", "ingresos operativos", "ingresos"] },
  { key: "costs", label: "Costos", aliases: ["costo de ventas", "costos de ventas", "costos"] },
  { key: "operatingExpenses", label: "Gastos operativos", aliases: ["gastos operativos", "gastos de administracion", "gastos de comercializacion"] },
  { key: "interest", label: "Intereses", aliases: ["resultados financieros", "costos financieros", "intereses"] },
  { key: "taxes", label: "Impuestos", aliases: ["impuesto a las ganancias", "impuestos"] },
  { key: "openingEquity", label: "Patrimonio neto inicial", aliases: ["patrimonio neto inicial", "patrimonio al inicio", "saldo inicial patrimonio"] },
  { key: "contributions", label: "Aportes de socios", aliases: ["aportes de socios", "aportes de propietarios", "aportes de capital"] },
  { key: "distributions", label: "Retiros y distribuciones", aliases: ["distribuciones", "retiros de socios", "dividendos"] },
  { key: "openingCash", label: "Efectivo al inicio", aliases: ["efectivo al inicio", "saldo inicial de efectivo", "efectivo inicial"] },
  { key: "operatingCashFlow", label: "Flujo operativo", aliases: ["actividades operativas", "flujo operativo"] },
  { key: "investingCashFlow", label: "Flujo de inversión", aliases: ["actividades de inversion", "flujo de inversion"] },
  { key: "financingCashFlow", label: "Flujo de financiación", aliases: ["actividades de financiacion", "flujo de financiacion"] },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function parseAmount(raw: string) {
  const compact = raw.replace(/[$\s]/g, "");
  const negative = compact.startsWith("-") || (compact.startsWith("(") && compact.endsWith(")"));
  const unsigned = compact.replace(/[()\-+]/g, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  let normalized = unsigned;

  if (lastComma > lastDot) {
    const decimals = unsigned.length - lastComma - 1;
    normalized = decimals === 2
      ? unsigned.replace(/\./g, "").replace(",", ".")
      : unsigned.replace(/[.,]/g, "");
  } else if (lastDot >= 0) {
    const decimals = unsigned.length - lastDot - 1;
    normalized = decimals === 2
      ? unsigned.replace(/,/g, "")
      : unsigned.replace(/[.,]/g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

function detectMetadata(text: string): DocumentImportResult["metadata"] {
  const normalized = normalize(text);
  const cuit = text.match(/\b(?:CUIT\s*:?\s*)?(\d{2}-\d{8}-\d)\b/i)?.[1];
  const explicitPeriod = text.match(
    /(?:ejercicio|periodo|período|al\s+\d{1,2}\s+de\s+\w+\s+de)\D{0,30}(20\d{2})/i,
  )?.[1];
  const fallbackPeriod = text.match(/\b(20\d{2})\b/)?.[1];
  const company = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) =>
      /(?:raz[oó]n social|denominaci[oó]n|empresa)\s*:/i.test(line),
    )
    ?.replace(/^.*?:\s*/, "")
    .slice(0, 100);

  let documentType = "Documento financiero";
  if (normalized.includes("estado de situacion patrimonial") || normalized.includes("balance general")) {
    documentType = "Estado de situación patrimonial";
  } else if (normalized.includes("estado de resultados") || normalized.includes("cuenta de resultados")) {
    documentType = "Estado de resultados";
  } else if (normalized.includes("flujo de efectivo") || normalized.includes("flujo de fondos")) {
    documentType = "Estado de flujo de efectivo";
  } else if (normalized.includes("balance") || normalized.includes("estados contables")) {
    documentType = "Estados contables";
  }

  return {
    company: company || undefined,
    cuit,
    period: explicitPeriod ?? fallbackPeriod,
    documentType,
  };
}

function detectValues(text: string): DocumentImportResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const detected: DocumentImportResult["detected"] = [];

  for (const field of importedFields) {
    const lineIndex = lines.findIndex((candidate) => {
      const normalized = normalize(candidate);
      return field.aliases.some((alias) => normalized.includes(alias)) &&
        !field.excludes?.some((excluded) => normalized.includes(excluded));
    });
    if (lineIndex < 0) continue;

    const lineAmounts = lines[lineIndex].match(/(?:-|\()?\s*\$?\s*\d[\d.,\s]*(?:\))?/g) ?? [];
    const nearbyAmounts = lines
      .slice(lineIndex + 1, lineIndex + 3)
      .join(" ")
      .match(/(?:-|\()?\s*\$?\s*\d[\d.,\s]*(?:\))?/g) ?? [];
    const parsed = (lineAmounts.length ? lineAmounts : nearbyAmounts)
      .map(parseAmount)
      .filter((value): value is number => value !== null);
    const value = lineAmounts.length ? parsed.at(-1) : parsed[0];
    if (value === undefined) continue;
    detected.push({ key: field.key, label: field.label, value });
  }

  const groups = {
    patrimonio: detected.filter((item) =>
      ["currentAssets", "nonCurrentAssets", "currentLiabilities", "nonCurrentLiabilities"].includes(item.key),
    ).length,
    resultados: detected.filter((item) =>
      ["revenue", "costs", "operatingExpenses", "interest", "taxes"].includes(item.key),
    ).length,
    flujo: detected.filter((item) =>
      ["openingCash", "operatingCashFlow", "investingCashFlow", "financingCashFlow"].includes(item.key),
    ).length,
  };
  const findings = [
    groups.patrimonio
      ? `Se reconocieron ${groups.patrimonio} conceptos de situación patrimonial.`
      : "",
    groups.resultados
      ? `Se reconocieron ${groups.resultados} conceptos del estado de resultados.`
      : "",
    groups.flujo
      ? `Se reconocieron ${groups.flujo} conceptos vinculados al flujo de efectivo.`
      : "",
  ].filter(Boolean);
  const warnings = [
    groups.patrimonio < 4 ? "La situación patrimonial está incompleta." : "",
    groups.resultados < 3 ? "El estado de resultados requiere revisión o datos adicionales." : "",
    groups.flujo === 0 ? "No se detectaron datos de flujo de efectivo." : "",
  ].filter(Boolean);

  return {
    values: Object.fromEntries(detected.map((item) => [item.key, item.value])),
    detected,
    metadata: detectMetadata(text),
    coverage: Math.round((detected.length / importedFields.length) * 100),
    findings,
    warnings,
  };
}

async function readPdf(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; text: string }[]>();
    content.items.forEach((item) => {
      if (!("str" in item) || !item.str.trim()) return;
      const x = item.transform?.[4] ?? 0;
      const y = Math.round(item.transform?.[5] ?? 0);
      rows.set(y, [...(rows.get(y) ?? []), { x, text: item.str }]);
    });
    pages.push(
      [...rows.entries()]
        .sort(([yA], [yB]) => yB - yA)
        .map(([, items]) =>
          items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" "),
        )
        .join("\n"),
    );
  }
  return pages.join("\n");
}

async function readWord(buffer: ArrayBuffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function readSpreadsheet(buffer: ArrayBuffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames
    .map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
    .join("\n");
}

export async function importFinancialDocument(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  let text = "";

  if (extension === "pdf") text = await readPdf(buffer);
  else if (extension === "docx") text = await readWord(buffer);
  else if (extension === "xlsx" || extension === "xls") text = await readSpreadsheet(buffer);
  else throw new Error("Formato no compatible. Usá PDF, DOCX, XLS o XLSX.");

  const result = detectValues(text);
  if (!result.detected.length) {
    throw new Error("No pudimos reconocer importes contables. Revisá que el archivo contenga conceptos y valores legibles.");
  }
  return result;
}
