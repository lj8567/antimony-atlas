import {
  CONFIDENCE_BAND_LABEL,
  confidenceBand,
  confidenceDetail,
  formatSeverity,
  formatStatus,
  PROVENANCE_DESCRIPTION,
  PROVENANCE_LABEL,
} from '@/lib/format';
import type { NodeStatus, ProvenanceClass } from '@/lib/supabase/types';
import { Hint } from './Hint';

/**
 * Provenance badge. Shape + colour + text: reported = round steel-blue dot,
 * modelled = amber diamond, unverified = hollow rose ring. Colour is never
 * the only signal — the label is always written out.
 */
export function ProvenanceBadge({
  provenance,
  withHint = true,
}: {
  provenance: ProvenanceClass | null | undefined;
  withHint?: boolean;
}) {
  if (!provenance) {
    return <span className="badge badge-neutral">No provenance</span>;
  }
  const badge = (
    <span className={`badge badge-${provenance}`}>
      <span className="dot" aria-hidden />
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
  if (!withHint) return badge;
  return <Hint text={PROVENANCE_DESCRIPTION[provenance]}>{badge}</Hint>;
}

/** Compact confidence meter with the exact 0–100 score and band on hover. */
export function ConfidenceIndicator({
  score,
  withHint = true,
}: {
  score: number | null | undefined;
  withHint?: boolean;
}) {
  const band = confidenceBand(score);
  if (score === null || score === undefined || band === null) {
    return <span className="note">Not scored</span>;
  }
  const body = (
    <span className={`conf conf-${band}`}>
      <span className="conf-meter" aria-hidden>
        <span className="conf-fill" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </span>
      <span>
        {CONFIDENCE_BAND_LABEL[band]} <span className="note">{score}</span>
      </span>
    </span>
  );
  if (!withHint) return body;
  return <Hint text={confidenceDetail(score)}>{body}</Hint>;
}

/** Node operating status with a coloured/shape-coded dot plus label. */
export function StatusLabel({ status }: { status: NodeStatus | string | null | undefined }) {
  const value = status ?? 'unknown';
  return (
    <span className={`status-label status-${value}`}>
      <span className="dot" aria-hidden />
      {formatStatus(value)}
    </span>
  );
}

/** Event severity 1–5 as filled blocks plus its label — obvious, not lurid. */
export function SeverityIndicator({ severity }: { severity: number | null | undefined }) {
  if (severity === null || severity === undefined) {
    return <span className="note">Unrated</span>;
  }
  const clamped = Math.max(1, Math.min(5, severity));
  return (
    <span className={`sev sev-${clamped}`}>
      <span className="sev-blocks" aria-hidden>
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={step <= clamped ? 'sev-block on' : 'sev-block'} />
        ))}
      </span>
      {formatSeverity(clamped)}
    </span>
  );
}
