import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import { BeneficiaryStateBadge } from "../components/StateBadge.jsx";
import { api, ApiError } from "../lib/api.js";
import { formatNaira } from "../lib/money.js";
import { useToast } from "../lib/toast.jsx";
import { setLastRun } from "../lib/lastRun.js";

export default function Review() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [run, setRun] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    if (!runId) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getRun(runId);
      setRun(data.run);
      setBeneficiaries(data.beneficiaries);
      setLoadError(null);
      setLastRun(data.run.id, data.run.status);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this run.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    setApproving(true);
    try {
      await api.approveRun(runId);
      toast.success("Run approved — execution is underway.");
      navigate(`/batch/${runId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not approve this run.");
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <AppShell active="review">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 text-center text-ink-soft">Loading run…</div>
      </AppShell>
    );
  }

  if (!runId) {
    return (
      <AppShell active="review">
        <div className="max-w-2xl mx-auto px-6 md:px-10 py-24 text-center">
          <Icon name="fact_check" size={40} className="text-ink-soft mx-auto mb-4" />
          <h1 className="font-display text-display-sm text-ink mb-2">Nothing waiting on review</h1>
          <p className="text-body text-ink-soft mb-6">
            Every run is either still a draft or has already been approved. Start a new one
            to see it here.
          </p>
          <Link to="/home" className="btn btn-primary">Start a payout</Link>
        </div>
      </AppShell>
    );
  }

  if (loadError || !run) {
    return (
      <AppShell active="review">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 text-center">
          <p className="text-state-failed text-[14px] mb-4">{loadError ?? "Run not found."}</p>
          <Link to="/home" className="btn btn-secondary">Back to start</Link>
        </div>
      </AppShell>
    );
  }

  const bankCount = beneficiaries.filter((b) => b.rail === "BANK").length;
  const paycodeCount = beneficiaries.filter((b) => b.rail === "PAYCODE").length;
  const flagged = beneficiaries.filter((b) => (b.flags ?? []).length > 0);
  const totalWithFees = (run.totalAmountKobo ?? 0) + (run.totalFeesKobo ?? 0);
  const canApprove = run.status === "REVIEW";

  return (
    <AppShell active="review">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="label-caps text-ink-soft mb-2">
              Batch <span className="mono">{run.id}</span> · {beneficiaries.length} beneficiaries
            </div>
            <h1 className="font-display text-display-sm text-ink">{run.title}</h1>
            <p className="text-body text-ink-soft mt-2 max-w-2xl">
              Review the normalised list before you authorise disbursement. Flagged rows
              need a decision.
            </p>
          </div>
          <Link to="/home" className="btn btn-secondary self-start md:self-auto">
            Back to start
          </Link>
        </div>

        {!canApprove && (
          <div className="border border-hairline bg-surface-sunk px-5 py-3 mb-6 text-[13px] text-ink-soft">
            This run is <span className="font-semibold text-ink">{run.status}</span>, so it can no
            longer be approved from here.{" "}
            <Link to={`/batch/${runId}`} className="text-ink underline underline-offset-2 hover:text-reach">
              View its live status →
            </Link>
          </div>
        )}

        {/* AI pre-flight brief — the model's actual written brief, not placeholder copy */}
        {run.preflightBrief && (
          <div className="border-l-2 border-ink bg-surface-sunk p-6 mb-8 max-w-3xl">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="auto_awesome" size={18} className="text-brass" fill />
              <span className="label-caps text-ink">AI pre-flight brief</span>
            </div>
            <p className="text-body text-ink-soft leading-relaxed whitespace-pre-line">
              {run.preflightBrief}
            </p>
          </div>
        )}

        {/* Ledger */}
        <div className="border border-hairline overflow-x-auto">
          <table className="ledger min-w-[720px]">
            <thead>
              <tr>
                <th className="w-[32%]">Beneficiary</th>
                <th className="w-[22%]">Phone</th>
                <th className="w-[14%]">Rail</th>
                <th className="w-[20%] text-right">Amount</th>
                <th className="w-[12%] text-center">State</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => {
                const flags = b.flags ?? [];
                const isFlagged = flags.length > 0;
                return (
                  <tr key={b.id} className={isFlagged ? "wash-failed" : ""}>
                    <td>
                      <div className="text-ink">{b.name}</div>
                      {flags.map((f, i) => (
                        <div key={i} className="text-[13px] text-state-failed mt-0.5 flex items-center gap-1">
                          <Icon name="error" size={15} />
                          {f}
                        </div>
                      ))}
                    </td>
                    <td className="mono text-ink-soft tabular-nums">{b.phone}</td>
                    <td>
                      <span className={b.rail === "BANK" ? "rail rail-bank" : "rail rail-paycode"}>
                        {b.rail === "PAYCODE" && <Icon name="qr_code_2" size={13} />}
                        {b.rail}
                      </span>
                    </td>
                    <td className="money text-ink text-right tabular-nums">{formatNaira(b.amountKobo)}</td>
                    <td className="text-center">
                      {isFlagged ? (
                        <span className="state s-failed justify-center">
                          <span className="dot dot--ring" />Review
                        </span>
                      ) : (
                        <BeneficiaryStateBadge status={b.status} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-4">
            <div className="flex items-center justify-between py-3 border-b border-hairline">
              <span className="text-[14px] text-ink-soft">
                {bankCount} bank transfer{bankCount === 1 ? "" : "s"} · {paycodeCount} Paycode
                {paycodeCount === 1 ? "" : "s"} fee{paycodeCount === 1 ? "" : "s"}
              </span>
              <span className="money text-ink-soft tabular-nums">{formatNaira(run.totalFeesKobo)}</span>
            </div>
            <div className="ledger-total flex items-center justify-between py-4">
              <span className="font-display text-subheading text-ink">Total authorised</span>
              <span className="money text-[22px] text-ink tabular-nums">{formatNaira(totalWithFees)}</span>
            </div>
          </div>
        </div>

        {flagged.length > 0 && canApprove && (
          <p className="text-[13px] text-ink-soft mt-3">
            <Icon name="info" size={15} className="text-brass inline-block align-text-bottom mr-1" />
            {flagged.length} row{flagged.length === 1 ? "" : "s"} flagged and will be held back —
            they stay in <span className="mono">PENDING_REVIEW</span> and won't be paid on approval.
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-end items-stretch sm:items-center gap-3 border-t border-hairline mt-8 pt-6">
          <button
            className="btn btn-primary !px-8"
            onClick={handleApprove}
            disabled={!canApprove || approving}
          >
            {approving ? "Approving…" : "Approve and pay"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}