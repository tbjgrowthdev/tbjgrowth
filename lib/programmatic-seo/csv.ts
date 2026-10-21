/**
 * Minimal RFC4180-ish CSV parser — no dependency, since this is the only
 * place in the codebase that needs one. Handles quoted fields, commas and
 * newlines inside quotes, and escaped ("") quotes. The first row is always
 * the header row.
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else {
      field += c;
    }
  }
  // Final field/row, unless the text ended cleanly on a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (nonEmptyRows.length === 0) return { columns: [], rows: [] };

  const columns = nonEmptyRows[0].map((c) => c.trim());
  const dataRows = nonEmptyRows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = (r[i] ?? "").trim();
    });
    return obj;
  });

  return { columns, rows: dataRows };
}
