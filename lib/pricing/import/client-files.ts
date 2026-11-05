"use client";

// Browser-only file encoding/decoding for the pricing import/export. The xlsx
// libraries run here (not on the server) so they never enter the Workers
// bundle; the server only ever sees plain cell matrices and re-validates them.

import { parseCsv } from "@/lib/csv";
import { LIMITS, matchSheetName } from "./sheets";
import { sheetToCsv, type Matrix } from "./export";
import type { RawWorkbook } from "./parse";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadXlsx(filename: string, sheets: { name: string; rows: Matrix }[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const data = sheets.map((s) => ({
    sheet: s.name,
    data: s.rows.map((row, r) =>
      row.map((c) => {
        if (c === "" || c === null || c === undefined) return null;
        const bold = r === 0 && s.name !== "Instructions" && s.name !== "Examples" ? { fontWeight: "bold" as const } : {};
        return typeof c === "number" ? { value: c, type: Number, ...bold } : { value: String(c), type: String, ...bold };
      }),
    ),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await (writeXlsxFile as any)(data).toBlob();
  download(blob, filename);
}

export function downloadCsv(filename: string, rows: Matrix) {
  download(new Blob(["﻿" + sheetToCsv(rows)], { type: "text/csv;charset=utf-8" }), filename);
}

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
};

export type ReadResult = { workbook: RawWorkbook; fileNames: string[] } | { error: string };

/** Reads one .xlsx, or any number of .csv files (entity named by file name, e.g. Prices.csv). */
export async function readUpload(files: File[]): Promise<ReadResult> {
  if (files.length === 0) return { error: "Choose a file first." };
  for (const f of files) {
    if (f.size > LIMITS.maxFileBytes) return { error: `${f.name} is larger than ${LIMITS.maxFileBytes / 1024 / 1024} MB.` };
    if (!/\.(xlsx|csv)$/i.test(f.name)) return { error: `${f.name}: only .xlsx and .csv files are supported.` };
  }
  const xlsx = files.filter((f) => /\.xlsx$/i.test(f.name));
  if (xlsx.length > 1 || (xlsx.length === 1 && files.length > 1)) return { error: "Upload a single .xlsx file, or one or more .csv files (not both)." };

  const workbook: RawWorkbook = {};
  if (xlsx.length === 1) {
    const head = new Uint8Array(await xlsx[0].slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x50 && head[1] === 0x4b)) return { error: `${xlsx[0].name} is not a valid .xlsx file.` };
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(xlsx[0]);
      for (const s of sheets) workbook[s.sheet] = s.data.map((row: unknown[]) => row.map(cellToString));
    } catch {
      return { error: `Couldn't read ${xlsx[0].name}. Is it a valid .xlsx file?` };
    }
  } else {
    for (const f of files) {
      const base = f.name.replace(/\.csv$/i, "");
      // "Prices.csv", "pricing - Prices.csv", "pricing_Prices.csv" all resolve to Prices.
      const name = matchSheetName(base) ?? matchSheetName(base.split(/[-_ ]+/).pop() ?? "");
      if (!name) return { error: `${f.name}: can't tell which sheet this is. Name the file after the sheet, e.g. Prices.csv.` };
      const text = (await f.text()).replace(/^﻿/, "");
      workbook[name] = parseCsv(text);
    }
  }
  return { workbook, fileNames: files.map((f) => f.name) };
}
