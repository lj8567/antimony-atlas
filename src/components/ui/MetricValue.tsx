import { formatPeriod, formatQuantity } from '@/lib/format';
import type { ObservationDetail } from '@/lib/supabase/types';
import { ProvenanceBadge } from './badges';

/**
 * A single observation rendered with its full qualifiers: metric name, value
 * with unit, period, product form and estimate type. Qualifiers are never
 * dropped — a modelled conversion must read as modelled.
 */
export function MetricValue({ observation, compact = false }: { observation: ObservationDetail; compact?: boolean }) {
  const metricName = observation.metric?.name ?? 'Unnamed metric';
  const value =
    observation.value_numeric !== null
      ? formatQuantity(observation.value_numeric, observation.unit)
      : observation.value_text ?? 'Not reported';
  const period = formatPeriod(observation.period_start, observation.period_end);

  if (compact) {
    return (
      <span>
        <span className="num" style={{ textAlign: 'left' }}>
          {value}
        </span>
        <span className="cell-sub">
          {metricName} · {period}
        </span>
      </span>
    );
  }

  return (
    <div>
      <div className="inline-list">
        <strong className="num" style={{ fontSize: 15 }}>
          {value}
        </strong>
        <ProvenanceBadge provenance={observation.estimate_type} />
      </div>
      <div className="note">
        {metricName}
        {observation.product_form ? ` · ${observation.product_form.name}` : ''} · {period}
      </div>
    </div>
  );
}
