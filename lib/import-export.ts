// Helpers for bulk-importing and exporting holdings as CSV / JSON, and
// triggering client-side file downloads. No external dependencies.

export interface RawHoldingRow {
  symbol: string;
  shares: string;
  avgPrice: string;
}

export interface ExportableHolding {
  symbol: string;
  company_name: string;
  quantity: number;
  avg_price: number;
}

/** Sample files shown to users so they know the expected format. */
export const SAMPLE_CSV = `symbol,shares,avg_price\nHNB.N0000,412,455.50\nJKH.N0000,150,182.25\nCOMB.N0000,300,98.75\n`;

export const SAMPLE_JSON = JSON.stringify(
  [
    { symbol: "HNB.N0000", shares: 412, avgPrice: 455.5 },
    { symbol: "JKH.N0000", shares: 150, avgPrice: 182.25 },
    { symbol: "COMB.N0000", shares: 300, avgPrice: 98.75 },
  ],
  null,
  2
);

/** Triggers a browser download of the given text content. */
export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Splits one CSV line into cells, respecting double-quoted values. */
function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}

const SYMBOL_ALIASES = ["symbol", "ticker", "code", "companysymbol", "company_symbol", "company symbol"];
const SHARES_ALIASES = ["shares", "quantity", "qty", "numberofshares", "number_of_shares", "number of shares"];
const PRICE_ALIASES = [
  "avgprice", "avg_price", "averageprice", "average_price", "average price",
  "currentaverageprice", "current_average_price", "current average price", "price",
];

/** Parses CSV text (with or without a header row) into raw rows for review. */
export function parseCSV(text: string): RawHoldingRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerCells = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/["']/g, "").trim());
  const symbolIdx = headerCells.findIndex(h => SYMBOL_ALIASES.includes(h));
  const sharesIdx = headerCells.findIndex(h => SHARES_ALIASES.includes(h));
  const priceIdx = headerCells.findIndex(h => PRICE_ALIASES.includes(h));
  const hasHeader = symbolIdx !== -1 && sharesIdx !== -1 && priceIdx !== -1;

  const [sI, shI, pI] = hasHeader ? [symbolIdx, sharesIdx, priceIdx] : [0, 1, 2];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map(line => {
      const cells = splitCSVLine(line);
      return {
        symbol: (cells[sI] || "").trim(),
        shares: (cells[shI] || "").trim(),
        avgPrice: (cells[pI] || "").trim(),
      };
    })
    .filter(r => r.symbol || r.shares || r.avgPrice);
}

/** Parses a JSON array of holdings (several common key shapes) into raw rows. */
export function parseJSONHoldings(text: string): RawHoldingRow[] {
  const data = JSON.parse(text);
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.holdings) ? data.holdings : null;
  if (!arr) throw new Error("Expected a JSON array of holdings (or an object with a \"holdings\" array).");

  return arr.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Row ${i + 1} is not an object.`);
    }
    const symbol = item.symbol ?? item.ticker ?? item.code ?? item.companySymbol ?? "";
    const shares = item.shares ?? item.quantity ?? item.qty ?? item.numberOfShares ?? "";
    const avgPrice =
      item.avgPrice ?? item.avg_price ?? item.averagePrice ?? item.average_price ?? item.price ?? "";
    return {
      symbol: String(symbol).trim(),
      shares: String(shares).trim(),
      avgPrice: String(avgPrice).trim(),
    };
  });
}

/** Parses an uploaded file (by extension) into raw rows for review/validation. */
export async function parseHoldingsFile(file: File): Promise<RawHoldingRow[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return parseJSONHoldings(text);
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCSV(text);
  // Fall back to sniffing the content.
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJSONHoldings(text);
  return parseCSV(text);
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function holdingsToCSV(holdings: ExportableHolding[]): string {
  const header = ["Symbol", "Company Name", "Shares", "Avg Price", "Total Cost"];
  const rows = holdings.map(h => [
    h.symbol,
    h.company_name,
    h.quantity,
    h.avg_price.toFixed(2),
    (h.quantity * h.avg_price).toFixed(2),
  ]);
  return [header, ...rows].map(r => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function holdingsToJSON(holdings: ExportableHolding[]): string {
  return JSON.stringify(
    holdings.map(h => ({
      symbol: h.symbol,
      company_name: h.company_name,
      shares: h.quantity,
      avg_price: h.avg_price,
    })),
    null,
    2
  );
}
