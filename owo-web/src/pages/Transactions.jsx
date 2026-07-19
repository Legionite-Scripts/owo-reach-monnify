import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import { BeneficiaryStateBadge } from "../components/StateBadge.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.jsx";
import { api, ApiError } from "../lib/api.js";
import { formatNaira, formatDateTime } from "../lib/money.js";
import { useLiveEvents } from "../lib/useLiveEvents.js";
import { useToast } from "../lib/toast.jsx";

const PAGE_SIZE = 10;

const STATE_FILTERS = {
  all: () => true,
  completed: (s) => s === "COMPLETED",
  "in-flight": (s) => ["QUEUED", "SENT", "CODE_ISSUED", "PENDING_AUTHORIZATION", "PENDING_REVIEW"].includes(s),
  failed: (s) => s === "FAILED",
  cancelled: (s) => s === "CANCELLED",
};

export default function Transactions() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);

  async function loadAll() {
    try {
      const runs = await api.listRuns();
      // The API only exposes beneficiaries per-run, so build the combined
      // ledger by fetching each run's detail. Fine at this product's scale
      // (single-org ops console, not a multi-tenant reporting system).
      const details = await Promise.all(runs.map((r) => api.getRun(r.id).catch(() => null)));
      const flattened = [];
      details.forEach((d, i) => {
        if (!d) return;
        for (const b of d.beneficiaries) {
          flattened.push({
            id: b.id,
            ref: b.monnifyReference ?? b.id,
            name: b.name,
            rail: b.rail,
            amountKobo: b.amountKobo,
            status: b.status,
            when: b.updatedAt,
            runTitle: runs[i].title,
          });
        }
      });
      flattened.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setRows(flattened);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useLiveEvents((type) => {
    if (type === "run.created" || type === "beneficiary.updated") loadAll();
  });

  const stats = useMemo(() => {
    const totalDisbursedKobo = rows
      .filter((r) => r.status === "COMPLETED")
      .reduce((sum, r) => sum + r.amountKobo, 0);
    const completed = rows.filter((r) => r.status === "COMPLETED").length;
    const inFlight = rows.filter((r) => STATE_FILTERS["in-flight"](r.status)).length;
    const failed = rows.filter((r) => r.status === "FAILED").length;
    return [
      ["Total disbursed", formatNaira(totalDisbursedKobo), "text-ink"],
      ["Completed", String(completed), "text-reach"],
      ["In flight", String(inFlight), "text-brass"],
      ["Failed", String(failed), "text-state-failed"],
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!STATE_FILTERS[stateFilter](r.status)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.ref.toLowerCase().includes(q) ||
        r.runTitle.toLowerCase().includes(q)
      );
    });
  }, [rows, query, stateFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function exportCsv() {
    const header = ["Reference", "Run", "Beneficiary", "Rail", "Amount (NGN)", "State", "Updated"];
    const csvRows = filtered.map((r) => [
      r.ref,
      r.runTitle,
      r.name,
      r.rail,
      (r.amountKobo / 100).toFixed(2),
      r.status,
      r.when ? new Date(r.when).toISOString() : "",
    ]);
    const csv = [header, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "owo-reach-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"}.`);
  }

  return (
    <AppShell active="transactions">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="label-caps text-ink-soft mb-2">Ledger · all runs</div>
            <h1 className="font-display text-display-sm text-ink">Transaction history</h1>
            <p className="text-body text-ink-soft mt-2">
              A complete audit log of every transfer and Paycode.
            </p>
          </div>
          <button className="btn btn-secondary self-start md:self-auto" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            <Icon name="download" size={18} />Export CSV
          </button>
        </div>

        {loadError && (
          <div className="border border-state-failed bg-white px-5 py-3 mb-6 text-[13px] text-state-failed">
            {loadError}
          </div>
        )}

        {/* Reconciliation strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-hairline mb-6">
          {stats.map(([label, value, color], i) => (
            <div
              key={label}
              className={`p-4 ${i < 3 ? "lg:border-r" : ""} ${i % 2 === 0 ? "border-r" : ""} ${
                i >= 2 ? "border-t lg:border-t-0" : ""
              } border-hairline`}
            >
              <div className="label-caps text-ink-soft mb-1">{label}</div>
              <div className={`money text-[18px] tabular-nums ${color}`}>{loading ? "…" : value}</div>
            </div>
          ))}
        </div>

        {/* Search & filter */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-hairline p-3 mb-4">
          <div className="relative flex-1">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Search by name, reference, or run"
              className="field !pl-10 !border-transparent focus:!border-hairline"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={stateFilter}
              onValueChange={(v) => {
                setStateFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in-flight">In flight</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ledger */}
        <div className="border border-hairline overflow-x-auto">
          <table className="ledger min-w-[820px]">
            <thead>
              <tr>
                <th className="w-[18%]">Reference</th>
                <th className="w-[16%]">Run</th>
                <th className="w-[20%]">Beneficiary</th>
                <th className="w-[10%]">Rail</th>
                <th className="w-[14%] text-right">Amount</th>
                <th className="w-[12%]">State</th>
                <th className="w-[10%] text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-ink-soft py-8">Loading transactions…</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-ink-soft py-8">No transactions match your filters.</td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const cancelled = r.status === "CANCELLED";
                  return (
                    <tr key={r.id}>
                      <td className="mono text-ink tabular-nums text-[12px]">{r.ref}</td>
                      <td className="text-ink-soft text-[13px]">{r.runTitle}</td>
                      <td className={cancelled ? "line-through text-ink-soft" : "text-ink"}>{r.name}</td>
                      <td>
                        <span className={r.rail === "BANK" ? "rail rail-bank" : "rail rail-paycode"}>
                          {r.rail === "PAYCODE" && <Icon name="qr_code_2" size={13} />}
                          {r.rail}
                        </span>
                      </td>
                      <td className={`money text-right tabular-nums ${cancelled ? "text-ink-soft line-through" : "text-ink"}`}>
                        {formatNaira(r.amountKobo)}
                      </td>
                      <td>
                        <BeneficiaryStateBadge status={r.status} />
                      </td>
                      <td className="mono text-ink-soft text-right tabular-nums text-[12px]">
                        {formatDateTime(r.when)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between mt-5">
            <span className="text-[13px] text-ink-soft">
              Showing <span className="mono">{(clampedPage - 1) * PAGE_SIZE + 1}</span>–
              <span className="mono">{Math.min(clampedPage * PAGE_SIZE, filtered.length)}</span> of{" "}
              <span className="mono">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-secondary !px-3 !py-1.5 !text-[11px] disabled:opacity-50"
                disabled={clampedPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="mono text-[12px] text-ink-soft px-2">
                {clampedPage} / {pageCount}
              </span>
              <button
                className="btn btn-secondary !px-3 !py-1.5 !text-[11px] disabled:opacity-50"
                disabled={clampedPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
