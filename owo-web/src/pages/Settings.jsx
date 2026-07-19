import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.jsx";
import { api, ApiError } from "../lib/api.js";
import { useToast } from "../lib/toast.jsx";

export default function Settings() {
  const toast = useToast();
  const [apiOnline, setApiOnline] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        if (!cancelled) setApiOnline(true);
      } catch {
        if (!cancelled) setApiOnline(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // These settings have no backing endpoint in the current API — Owó Reach's
  // backend covers runs, beneficiaries, banks, webhooks, and the live event
  // stream, but not org/profile/key management. Rather than fake a save, we
  // say so plainly.
  function notWired(label) {
    toast.info(`${label} isn't backed by the API yet — this build only wires runs, beneficiaries, and webhooks.`);
  }

  return (
    <AppShell active="settings">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <header className="pb-6 mb-8 border-b border-hairline">
          <div className="label-caps text-ink-soft mb-2">Ops console</div>
          <h1 className="font-display text-display-sm text-ink">Settings</h1>
          <p className="text-body text-ink-soft mt-2">
            Manage your organisation preferences, security, and integrations.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 hidden lg:block">
            <nav className="sticky top-20 space-y-1">
              <a href="#profile" className="block py-2 pl-4 border-l-2 border-ink text-ink font-medium text-[14px]">Profile</a>
              <a href="#security" className="block py-2 pl-4 border-l-2 border-transparent text-ink-soft hover:text-ink text-[14px] transition-colors">Security</a>
              <a href="#organisation" className="block py-2 pl-4 border-l-2 border-transparent text-ink-soft hover:text-ink text-[14px] transition-colors">Organisation</a>
              <a href="#api" className="block py-2 pl-4 border-l-2 border-transparent text-ink-soft hover:text-ink text-[14px] transition-colors">API &amp; webhooks</a>
            </nav>
          </aside>

          <div className="lg:col-span-9 space-y-12">
            {/* Profile */}
            <section id="profile" className="scroll-mt-20">
              <h2 className="font-display text-heading text-ink mb-4">Profile</h2>
              <div className="border border-hairline">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-hairline">
                    <label className="field-label">Full name</label>
                    <input className="field" type="text" defaultValue="System Administrator" readOnly />
                  </div>
                  <div className="p-5 border-b border-hairline">
                    <label className="field-label">Email address</label>
                    <input className="field" type="email" defaultValue="admin@oworeach.com" readOnly />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-hairline">
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-hairline">
                    <label className="field-label">Role</label>
                    <span className="inline-flex items-center label-caps text-ink bg-surface-sunk border border-hairline px-2 py-1 rounded-sm">
                      Administrator
                    </span>
                  </div>
                  <div className="p-5 flex items-end justify-end bg-surface-sunk">
                    <button className="btn btn-secondary" onClick={() => notWired("Profile editing")}>Edit profile</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Security */}
            <section id="security" className="scroll-mt-20">
              <h2 className="font-display text-heading text-ink mb-4">Security</h2>
              <div className="border border-hairline divide-y divide-hairline">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-subheading font-display text-ink">Password</h3>
                    <p className="text-[14px] text-ink-soft mt-1">Not tracked by the current API.</p>
                  </div>
                  <button className="btn btn-primary self-start sm:self-auto" onClick={() => notWired("Password updates")}>
                    Update password
                  </button>
                </div>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-subheading font-display text-ink">Sandbox MFA on transfers</h3>
                    <p className="text-[14px] text-ink-soft mt-1">
                      Monnify's sandbox requires OTP authorisation on bank transfers — handled as a
                      maker-checker step on the Live batch screen.
                    </p>
                  </div>
                  <span className="state s-complete text-[12px]"><span className="dot dot--fill" />Enforced</span>
                </div>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-subheading font-display text-ink">Audited code reveals</h3>
                    <p className="text-[14px] text-ink-soft mt-1">Every Paycode reveal is written to the event log. Always on.</p>
                  </div>
                  <span className="state s-issued text-[12px] self-start sm:self-auto"><span className="dot dot--ring" />Enforced</span>
                </div>
              </div>
            </section>

            {/* Organisation */}
            <section id="organisation" className="scroll-mt-20">
              <h2 className="font-display text-heading text-ink mb-4">Organisation</h2>
              <div className="border border-hairline">
                <div className="p-5 border-b border-hairline">
                  <label className="field-label">Business name</label>
                  <input className="field" type="text" defaultValue="Green Harvest Co-op" readOnly />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-hairline">
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-hairline">
                    <label className="field-label">Primary currency</label>
                    <Select defaultValue="NGN" disabled>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-5">
                    <label className="field-label">Fee schedule</label>
                    <div className="field !flex items-center !text-ink-soft cursor-default">
                      Flat ₦100.00 per Paycode
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-surface-sunk flex justify-end">
                  <p className="text-[13px] text-ink-soft italic">
                    Organisation core details are set at the Monnify contract level, not per-run.
                  </p>
                </div>
              </div>
            </section>

            {/* API & webhooks */}
            <section id="api" className="scroll-mt-20 pb-10">
              <h2 className="font-display text-heading text-ink mb-4">API &amp; webhooks</h2>

              <div className="border border-hairline mb-6">
                <div className="p-5 border-b border-hairline flex items-center justify-between bg-surface-sunk">
                  <h3 className="text-subheading font-display text-ink">Backend connection</h3>
                  <span className={`state text-[12px] ${apiOnline === false ? "s-failed" : "s-complete"}`}>
                    <span className={`dot ${apiOnline === false ? "dot--fill" : "dot--fill"}`} />
                    {checking ? "Checking…" : apiOnline ? "Reachable" : "Unreachable"}
                  </span>
                </div>
                <div className="p-5">
                  <label className="field-label">Base URL</label>
                  <input className="field mono !text-[13px]" type="text" value="http://localhost:3000/api" readOnly />
                  <p className="text-[13px] text-ink-soft mt-2">
                    Proxied from this app's <span className="mono">/api</span> path in dev; served
                    from the same origin in production.
                  </p>
                </div>
              </div>

              <div className="border border-hairline">
                <div className="p-5 border-b border-hairline flex items-center justify-between bg-surface-sunk">
                  <h3 className="text-subheading font-display text-ink">Monnify webhook endpoint</h3>
                  <span className="state s-complete text-[12px]"><span className="dot dot--fill" />Active</span>
                </div>
                <div className="p-5 border-b border-hairline">
                  <label className="field-label">Endpoint path</label>
                  <input className="field mono !text-[13px]" type="text" defaultValue="/api/webhooks/monnify" readOnly />
                  <p className="text-[13px] text-ink-soft mt-2">
                    HMAC-SHA512 signature required on every request (see docs/PRD.md §9). Set the
                    public URL for this path in the Monnify dashboard — a Cloudflare Tunnel URL in
                    dev, your deployed URL in production.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
