// Minimal RFC4180-ish CSV helpers shared by every CSV export/import in
// lib/import-export.ts. Fields are quoted only when they contain a comma,
// quote, or newline; embedded quotes are doubled — standard CSV escaping,
// not a bespoke format.

function escapeCsvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c])).join(","));
  }
  return lines.join("\n");
}

/**
 * Parses CSV text into rows of string cells, honoring quoted fields that may
 * contain commas/newlines/escaped ("") quotes. Handles both \r\n and \n line
 * endings. A plain split(",")/split("\n") (as the earlier redirect importer
 * used) breaks the moment any field contains a comma or embedded newline —
 * this is the general-purpose parser the other importers below need.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Parses CSV text with a header row into objects keyed by trimmed header name. */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((r) => {
    const obj: Record<string, string> = {};
    keys.forEach((key, idx) => {
      obj[key] = r[idx] ?? "";
    });
    return obj;
  });
}
