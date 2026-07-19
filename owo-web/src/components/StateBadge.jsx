import { statusMeta, runStatusMeta } from "../lib/statusMeta.js";

export function BeneficiaryStateBadge({ status, className = "" }) {
  const meta = statusMeta(status);
  return (
    <span className={`state justify-center ${meta.cls} ${className}`}>
      <span className={`dot ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function RunStateBadge({ status, className = "" }) {
  const meta = runStatusMeta(status);
  return (
    <span className={`state justify-center ${meta.cls} ${className}`}>
      <span className={`dot ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
