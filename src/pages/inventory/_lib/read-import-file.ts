import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";

export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;

// Reads the first sheet of an .xlsx file, or a .csv file, as rows of cells
export async function readImportFile(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error("File is larger than 20 MB");
  if (name.endsWith(".xlsx")) {
    const sheets = await readXlsxFile(file);
    const first = sheets[0];
    if (!first) throw new Error("The spreadsheet has no sheets");
    return first.data;
  }
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true, dynamicTyping: false });
    // Broken quoting makes row boundaries unreliable, so refuse the file
    const fatal = result.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter");
    if (fatal) throw new Error(`The CSV file could not be read: ${fatal.message}`);
    return result.data;
  }
  throw new Error("Choose an Excel (.xlsx) or CSV file");
}
