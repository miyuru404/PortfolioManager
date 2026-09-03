"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { round } from "@/lib/utils";
import {
  parseHoldingsFile, SAMPLE_CSV, SAMPLE_JSON, downloadFile,
  type RawHoldingRow,
} from "@/lib/import-export";
import { Plus, Trash2, Upload, Loader2, Check, AlertCircle, X, FileDown } from "lucide-react";

interface BulkRow {
  key: string;
  symbol: string;
  shares: string;
  avgPrice: string;
  status: "idle" | "checking" | "valid" | "invalid";
  companyName?: string;
  error?: string;
}

interface Props {
  userId: string;
  existingSymbols: Set<string>;
  onSaved: (count: number) => void;
  onCancel: () => void;
}

let keySeq = 0;
function newKey() { return `row-${Date.now()}-${keySeq++}`; }

function emptyRow(): BulkRow {
  return { key: newKey(), symbol: "", shares: "", avgPrice: "", status: "idle" };
}

function isBlank(r: BulkRow) {
  return !r.symbol.trim() && !r.shares.trim() && !r.avgPrice.trim();
}

function localFieldError(r: BulkRow): string | null {
  if (!r.symbol.trim()) return "Symbol required";
  if (!/^[A-Za-z0-9.\-]{2,20}$/.test(r.symbol.trim())) return "Symbol looks invalid";
  const shares = Number(r.shares);
  if (!r.shares.trim() || !Number.isFinite(shares) || shares <= 0 || !Number.isInteger(shares)) {
    return "Shares must be a whole number > 0";
  }
  const price = Number(r.avgPrice);
  if (!r.avgPrice.trim() || !Number.isFinite(price) || price <= 0) {
    return "Avg price must be a number > 0";
  }
  return null;
}

export default function BulkAddHoldings({ userId, existingSymbols, onSaved, onCancel }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<BulkRow[]>(() => [emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const [showSample, setShowSample] = useState<"csv" | "json" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRows(count = 1) {
    setRows(prev => [...prev, ...Array.from({ length: count }, () => emptyRow())]);
  }

  function removeRow(key: string) {
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.key !== key)));
  }

  async function validateRow(key: string) {
    const row = rowsRef.current.find(r => r.key === key);
    if (!row) return;
    const err = localFieldError(row);
    if (err) {
      updateRow(key, { status: "invalid", error: err, companyName: undefined });
      return;
    }
    updateRow(key, { status: "checking", error: undefined });
    try {
      const res = await fetch(`/api/cse/search?symbol=${encodeURIComponent(row.symbol.trim().toUpperCase())}`);
      const data = await res.json();
      // Bail out if the row changed while the request was in flight.
      const latest = rowsRef.current.find(r => r.key === key);
      if (!latest || latest.symbol !== row.symbol) return;
      if (data.error) {
        updateRow(key, { status: "invalid", error: "Symbol not found on CSE" });
      } else {
        updateRow(key, { status: "valid", error: undefined, companyName: data.name });
      }
    } catch {
      updateRow(key, { status: "invalid", error: "Couldn't verify symbol (network error)" });
    }
  }

  // Sequential queue so a big paste/import doesn't fire dozens of requests at once.
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  function enqueueValidate(key: string) {
    if (!queueRef.current.includes(key)) queueRef.current.push(key);
    if (!runningRef.current) processQueue();
  }
  async function processQueue() {
    runningRef.current = true;
    while (queueRef.current.length) {
      const key = queueRef.current.shift()!;
      await validateRow(key);
      await new Promise(r => setTimeout(r, 120));
    }
    runningRef.current = false;
  }

  function handleFieldBlur(key: string) {
    const row = rowsRef.current.find(r => r.key === key);
    if (row && !isBlank(row)) enqueueValidate(key);
  }

  function handlePasteIntoSymbol(key: string, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/\t|\r|\n/.test(text)) return; // plain single value, let default paste happen
    e.preventDefault();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: BulkRow[] = lines.map(line => {
      const cells = line.split(/\t|,/).map(c => c.trim());
      return { key: newKey(), symbol: (cells[0] || "").toUpperCase(), shares: cells[1] || "", avgPrice: cells[2] || "", status: "idle" as const };
    });
    if (parsed.length === 0) return;
    setRows(prev => {
      const idx = prev.findIndex(r => r.key === key);
      const next = [...prev];
      next.splice(idx, 1, ...parsed);
      return next;
    });
    parsed.forEach(r => enqueueValidate(r.key));
  }

  async function handleFile(file: File) {
    setFormError("");
    try {
      const parsed: RawHoldingRow[] = await parseHoldingsFile(file);
      if (parsed.length === 0) {
        setFormError("No rows found in that file. Check it matches the sample format below.");
        return;
      }
      const newRows: BulkRow[] = parsed.map(p => ({
        key: newKey(),
        symbol: p.symbol.toUpperCase(),
        shares: p.shares,
        avgPrice: p.avgPrice,
        status: "idle",
      }));
      setRows(prev => {
        const kept = prev.filter(r => !isBlank(r));
        return [...kept, ...newRows];
      });
      newRows.forEach(r => enqueueValidate(r.key));
    } catch (err: any) {
      setFormError(err.message || "Couldn't read that file.");
    }
  }

  const activeRows = rows.filter(r => !isBlank(r));
  const validRows = activeRows.filter(r => r.status === "valid");
  const invalidRows = activeRows.filter(r => r.status === "invalid");
  const checkingCount = activeRows.filter(r => r.status === "checking").length;

  async function saveAll() {
    setFormError("");
    // Make sure every active, not-yet-checked row gets validated before saving.
    rowsRef.current.filter(r => !isBlank(r) && r.status === "idle").forEach(r => enqueueValidate(r.key));
    while (runningRef.current || queueRef.current.length) {
      await new Promise(r => setTimeout(r, 100));
    }

    const finalValid = rowsRef.current.filter(r => !isBlank(r) && r.status === "valid");
    if (finalValid.length === 0) {
      setFormError("No valid rows to save yet — fix the errors shown above.");
      return;
    }

    setSaving(true);
    const payload = finalValid.map(r => ({
      user_id: userId,
      symbol: r.symbol.trim().toUpperCase(),
      company_name: r.companyName || r.symbol.trim().toUpperCase(),
      quantity: Math.trunc(Number(r.shares)),
      avg_price: round(Number(r.avgPrice), 2),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("holdings").upsert(payload, { onConflict: "user_id,symbol" });
    setSaving(false);
    if (!error) {
      onSaved(payload.length);
    } else {
      setFormError(error.message);
    }
  }

  return (
    <div className="card animate-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Add multiple holdings</p>
          <p className="text-xs mt-0.5" style={{ color: "rgb(var(--ink-muted))" }}>
            Type rows below, paste from a spreadsheet, or import a CSV/JSON file.
            Required: symbol, number of shares, average price.
          </p>
        </div>
        <button onClick={onCancel}>
          <X className="w-4 h-4" style={{ color: "rgb(var(--ink-faint))" }} />
        </button>
      </div>

      {/* File import */}
      <div className="p-3 rounded-lg flex flex-wrap items-center gap-3" style={{ background: "rgb(var(--surface))" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.txt"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <button onClick={() => fileInputRef.current?.click()} className="btn-ghost flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" /> Import CSV or JSON
        </button>
        <button onClick={() => setShowSample(showSample === "csv" ? null : "csv")}
          className="text-xs underline" style={{ color: "rgb(var(--ink-muted))" }}>
          CSV format
        </button>
        <button onClick={() => setShowSample(showSample === "json" ? null : "json")}
          className="text-xs underline" style={{ color: "rgb(var(--ink-muted))" }}>
          JSON format
        </button>
      </div>

      {showSample && (
        <div className="p-3 rounded-lg text-xs font-mono space-y-2" style={{ background: "rgb(var(--surface))" }}>
          <div className="flex items-center justify-between">
            <span className="font-sans" style={{ color: "rgb(var(--ink-muted))" }}>
              {showSample === "csv" ? "Expected CSV format" : "Expected JSON format"}
            </span>
            <button
              onClick={() => downloadFile(
                showSample === "csv" ? "holdings-sample.csv" : "holdings-sample.json",
                showSample === "csv" ? SAMPLE_CSV : SAMPLE_JSON,
                showSample === "csv" ? "text/csv" : "application/json"
              )}
              className="flex items-center gap-1 text-xs font-sans font-medium"
              style={{ color: "rgb(var(--brand-500))" }}>
              <FileDown className="w-3 h-3" /> Download sample
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{showSample === "csv" ? SAMPLE_CSV : SAMPLE_JSON}</pre>
        </div>
      )}

      {formError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
          {formError}
        </div>
      )}

      {/* Editable grid */}
      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "rgb(var(--surface-border))" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
              {["Symbol", "Shares", "Avg Price", "Status", ""].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color: "rgb(var(--ink-faint))" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const existing = existingSymbols.has(r.symbol.trim().toUpperCase());
              return (
                <tr key={r.key} style={{ borderBottom: "1px solid rgb(var(--surface-border))" }}>
                  <td className="px-3 py-1.5">
                    <input
                      className="input py-1.5"
                      placeholder="HNB.N0000"
                      value={r.symbol}
                      onChange={e => updateRow(r.key, { symbol: e.target.value.toUpperCase(), status: "idle", error: undefined })}
                      onBlur={() => handleFieldBlur(r.key)}
                      onPaste={e => handlePasteIntoSymbol(r.key, e)}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="input py-1.5 w-24"
                      type="number" min="1"
                      value={r.shares}
                      onChange={e => updateRow(r.key, { shares: e.target.value, status: "idle" })}
                      onBlur={() => handleFieldBlur(r.key)}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className="input py-1.5 w-28"
                      type="number" step="0.01" min="0"
                      value={r.avgPrice}
                      onChange={e => updateRow(r.key, { avgPrice: e.target.value, status: "idle" })}
                      onBlur={() => handleFieldBlur(r.key)}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                    {isBlank(r) ? null : r.status === "checking" ? (
                      <span className="flex items-center gap-1" style={{ color: "rgb(var(--ink-faint))" }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking
                      </span>
                    ) : r.status === "valid" ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" /> {r.companyName}{existing ? " (updates existing)" : ""}
                      </span>
                    ) : r.status === "invalid" ? (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="w-3 h-3" /> {r.error}
                      </span>
                    ) : (
                      <span style={{ color: "rgb(var(--ink-faint))" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <button onClick={() => removeRow(r.key)}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "rgb(var(--ink-faint))" }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={() => addRows(3)} className="text-xs flex items-center gap-1" style={{ color: "rgb(var(--brand-500))" }}>
        <Plus className="w-3.5 h-3.5" /> Add 3 more rows
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={saveAll} disabled={saving || activeRows.length === 0} className="btn-primary">
          {saving
            ? "Saving..."
            : validRows.length > 0
              ? `Save ${validRows.length} holding${validRows.length === 1 ? "" : "s"}`
              : "Validate & save"}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        {checkingCount > 0 && (
          <span className="text-xs flex items-center gap-1" style={{ color: "rgb(var(--ink-faint))" }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Validating {checkingCount}...
          </span>
        )}
        {invalidRows.length > 0 && (
          <span className="text-xs text-red-500">{invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} need fixing</span>
        )}
      </div>
    </div>
  );
}
