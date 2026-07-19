import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import { BeneficiaryStateBadge, RunStateBadge } from "../components/StateBadge.jsx";
import { api, ApiError } from "../lib/api.js";
import { formatNaira, formatClock } from "../lib/money.js";
import { TERMINAL_BENEFICIARY_STATES } from "../lib/statusMeta.js";
import { useLiveEvents } from "../lib/useLiveEvents.js";
import { useToast } from "../lib/toast.jsx";
import { setLastRun } from "../lib/lastRun.js";
import { describeEvent } from "../lib/describeEvent.js";

export default function Batch() {
  const { runId } = useParams();
  const toast = useToast();

  const [run, setRun] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState({}); // beneficiaryId -> true while an action is in flight
  const [otpDrafts, setOtpDrafts] = useState({}); // beneficiaryId -> typed OTP
  const flippedRef = useRef({});

  const load = useCallback(async () => {
    if (!runId) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getRun(runId);
      setRun(data.run);
      setBeneficiaries(data.beneficiaries);
      setEventLog(data.events);
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

  // Live wire: any change relevant to this run refreshes it. Simple and
  // correct beats a hand-rolled merge of partial SSE payloads.
  useLiveEvents((type) => {
    if (
      type === "run.updated" ||
      type === "beneficiary.updated" ||
      type === "beneficiary.paycode_revealed" ||
      type === "beneficiary.nudge_sent" ||
      type === "webhook.received"
    ) {
      load();
    }
  });

  const beneficiaryMap = useMemo(() => {
    const m = {};
    for (const b of beneficiaries) m[b.id] = b;
    return m;
  }, [beneficiaries]);

  function setRowBusy(id, value) {
    setBusy((b) => ({ ...b, [id]: value }));
  }

  async function runAction(id, fn, { successMessage } = {}) {
    setRowBusy(id, true);
    try {
      const result = await fn();
      if (successMessage) toast.success(successMessage);
      await load();
      return result;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That action failed.");
    } finally {
      setRowBusy(id, false);
    }
  }

  const handleSubmitOtp = (id) =>
    runAction(
      id,
      () => api.submitOtp(id, (otpDrafts[id] ?? "").trim()),
      { successMessage: "OTP accepted — transfer authorised." }
    );

  const handleResendOtp = (id) =>
    runAction(id, () => api.resendOtp(id), { successMessage: "OTP resent." });

  const handleReveal = async (id) => {
    setRowBusy(id, true);
    try {
      const { paycode } = await api.revealPaycode(id);
      toast.info(`Paycode for ${beneficiaryMap[id]?.name ?? "this beneficiary"}: ${paycode}`, {
        duration: 15000,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reveal this code.");
    } finally {
      setRowBusy(id, false);
    }
  };

  const handleNudge = async (id) => {
    setRowBusy(id, true);
    try {
      const { sms } = await api.nudgeBeneficiary(id);
      toast.info(`Nudge composed: "${sms}"`, { duration: 12000 });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send that nudge.");
    } finally {
      setRowBusy(id, false);
    }
  };

  const handleCancel = (id) =>
    runAction(id, () => api.cancelBeneficiary(id), { successMessage: "Beneficiary cancelled — amount refunded to the run total." });

  const handleReissue = (id) =>
    runAction(id, () => api.reissuePaycode(id), { successMessage: "New paycode issued." });

  if (loading) {
    return (
      <AppShell active="batch">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 text-center text-ink-soft">Loading run…</div>
      </AppShell>
    );
  }

  if (!runId) {
    return (
      <AppShell active="batch">
        <div className="max-w-2xl mx-auto px-6 md:px-10 py-24 text-center">
          <Icon name="sync" size={40} className="text-ink-soft mx-auto mb-4" />
          <h1 className="font-display text-display-sm text-ink mb-2">No batch is running right now</h1>
          <p className="text-body text-ink-soft mb-6">
            Nothing is currently executing. Approve a run from Payout review to watch it
            settle live here.
          </p>
          <Link to="/home" className="btn btn-primary">Start a payout</Link>
        </div>
      </AppShell>
    );
  }

  if (loadError || !run) {
    return (
      <AppShell active="batch">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 text-center">
          <p className="text-state-failed text-[14px] mb-4">{loadError ?? "Run not found."}</p>
          <Link to="/home" className="btn btn-secondary">Back to start</Link>
        </div>
      </AppShell>
    );
  }

  const total = beneficiaries.length;
  const terminal = beneficiaries.filter((b) => TERMINAL_BENEFICIARY_STATES.includes(b.status));
  const completed = beneficiaries.filter((b) => b.status === "COMPLETED");
  const landedKobo = completed.reduce((sum, b) => sum + b.amountKobo, 0);
  const outstandingKobo = Math.max(0, (run.totalAmountKobo ?? 0) - landedKobo);
  const pct = total === 0 ? 0 : (terminal.length / total) * 100;
  const done = total > 0 && terminal.length === total;

  return (
    <AppShell active="batch">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
          <div>
            <div className="label-caps text-ink-soft mb-2 flex items-center gap-2 flex-wrap">
              Batch <span className="mono">{run.id}</span>
              <RunStateBadge status={run.status} className="!text-[11px]" />
            </div>
            <h1 className="font-display text-display-sm md:text-display-lg text-ink">
              Did everyone get paid?
            </h1>
          </div>
          <div className="text-left lg:text-right">
            <div className="money text-[28px] text-ink tabular-nums">
              {terminal.length} <span className="text-ink-soft text-[20px]">of</span> {total} settled
            </div>
            <button onClick={load} className="label-caps text-ink-soft hover:text-ink mt-1 inline-flex items-center gap-1">
              <Icon name="sync" size={13} />
              {done ? "All landed · reconciled" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="h-[3px] w-full bg-hairline mb-10 overflow-hidden">
          <div className="h-full bg-reach transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Execution ledger */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-ink-soft">Execution queue</span>
            </div>
            <div className="border border-hairline overflow-x-auto">
              <table className="ledger min-w-[640px]">
                <thead>
                  <tr>
                    <th className="w-[26%]">Beneficiary</th>
                    <th className="w-[16%] text-right">Amount</th>
                    <th className="w-[18%] text-center">State</th>
                    <th className="w-[40%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((b) => {
                    const rowBusy = !!busy[b.id];
                    return (
                      <tr key={b.id}>
                        <td className="text-ink">
                          {b.name}
                          <div className="mono text-[11px] text-ink-soft">{b.monnifyReference ?? "—"}</div>
                        </td>
                        <td className="money text-ink text-right tabular-nums">{formatNaira(b.amountKobo)}</td>
                        <td className="text-center">
                          <BeneficiaryStateBadge status={b.status} />
                        </td>
                        <td>
                          {b.status === "PENDING_AUTHORIZATION" && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="OTP"
                                className="field !py-1.5 !px-2 !text-[12px] w-20"
                                value={otpDrafts[b.id] ?? ""}
                                onChange={(e) => setOtpDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                                disabled={rowBusy}
                              />
                              <button
                                className="btn btn-primary !py-1.5 !px-2.5 !text-[11px]"
                                onClick={() => handleSubmitOtp(b.id)}
                                disabled={rowBusy || !(otpDrafts[b.id] ?? "").trim()}
                              >
                                Submit
                              </button>
                              <button
                                className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]"
                                onClick={() => handleResendOtp(b.id)}
                                disabled={rowBusy}
                              >
                                Resend
                              </button>
                            </div>
                          )}

                          {b.status === "CODE_ISSUED" && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleReveal(b.id)} disabled={rowBusy}>
                                <Icon name="visibility" size={14} />Reveal
                              </button>
                              <button className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleNudge(b.id)} disabled={rowBusy}>
                                <Icon name="send" size={14} />Nudge
                              </button>
                              <button className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleCancel(b.id)} disabled={rowBusy}>
                                <Icon name="ban" size={14} />Cancel
                              </button>
                              {b.paycodeExpiresAt && (
                                <span className="mono text-[11px] text-ink-soft inline-flex items-center gap-1">
                                  <Icon name="clock" size={12} />
                                  exp {formatClock(b.paycodeExpiresAt)}
                                </span>
                              )}
                            </div>
                          )}

                          {b.status === "EXPIRED" && (
                            <div className="flex items-center gap-1.5">
                              <button className="btn btn-primary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleReissue(b.id)} disabled={rowBusy}>
                                <Icon name="sync" size={14} />Reissue
                              </button>
                              <button className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleCancel(b.id)} disabled={rowBusy}>
                                Cancel
                              </button>
                            </div>
                          )}

                          {(b.status === "QUEUED" || b.status === "SENT") && (
                            <button className="btn btn-secondary !py-1.5 !px-2.5 !text-[11px]" onClick={() => handleCancel(b.id)} disabled={rowBusy}>
                              <Icon name="ban" size={14} />Cancel
                            </button>
                          )}

                          {["COMPLETED", "FAILED", "CANCELLED"].includes(b.status) && (
                            <span className="text-[12px] text-ink-soft">No actions remaining</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Reconciliation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 border border-hairline border-t-0 divide-y sm:divide-y-0 divide-hairline">
              <div className="p-4 sm:border-r border-hairline">
                <div className="label-caps text-ink-soft mb-1">Sent</div>
                <div className="money text-[18px] text-ink tabular-nums">{formatNaira(run.totalAmountKobo)}</div>
              </div>
              <div className="p-4 sm:border-r border-hairline">
                <div className="label-caps text-ink-soft mb-1">Redeemed / landed</div>
                <div className="money text-[18px] text-reach tabular-nums">{formatNaira(landedKobo)}</div>
              </div>
              <div className="p-4">
                <div className="label-caps text-ink-soft mb-1">Outstanding</div>
                <div className="money text-[18px] text-brass tabular-nums">{formatNaira(outstandingKobo)}</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                to={`/audit/${runId}`}
                className={`btn btn-primary ${done ? "" : "opacity-40 pointer-events-none"}`}
              >
                View audit receipt
              </Link>
            </div>
          </div>

          {/* Activity feed — the run's real append-only event log */}
          <aside className="lg:col-span-1">
            <span className="label-caps text-ink-soft">Activity</span>
            <div className="mt-3 border border-hairline divide-y divide-hairline max-h-[560px] overflow-y-auto">
              {eventLog.length === 0 ? (
                <div className="p-3 text-[13px] text-ink-soft">No activity yet.</div>
              ) : (
                eventLog.map((e, i) => (
                  <div key={e.id} className={`p-3 flex gap-3 items-start ${i === 0 ? "animate-settle" : ""}`}>
                    <span className="mono text-[12px] text-ink-soft pt-0.5 shrink-0">{formatClock(e.createdAt)}</span>
                    <span className="text-[13px] text-ink">{describeEvent(e, beneficiaryMap)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 label-caps text-ink-soft">
              <Icon name="shield" size={16} className="text-reach" />
              Reconciliation sweep · every 60s
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}