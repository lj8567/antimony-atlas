import { formatMetricName, formatPeriod, formatQuantity } from '@/lib/format';
import type { ObservationDetail } from '@/lib/supabase/types';
import { ProvenanceBadge } from './badges';

/**
 * A single observation rendered with its full qualifiers: metric name, value
 * with its stored unit, period, product form and provenance. Qualifiers are
 * never dropped — a modelled conversion must read as modelled, and a
 * capacity must never read as production.
 */
export function MetricValue({ observation, compact = false }: { observation: ObservationDetail; compact?: boolean }) {
  const metricLabel = formatMetricName(observation.metric_name);
  const value =
    observation.value_numeric !== null ? formatQuantity(observation.value_numeric, observation.unit) : 'Not reported';
  const period = formatPeriod(observation.period_start, observation.period_end);

  if (compact) {
    return (
      <span>
        <span className="num" style={{ textAlign: 'left' }}>
          {value}
        </span>
        <span className="cell-sub">
          {metricLabel} · {period}
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
        <ProvenanceBadge provenance={observation.provenance} />
      </div>
      <div className="note">
        {metricLabel}
        {observation.product_form ? ` · ${observation.product_form.name}` : ''} · {period}
      </div>
    </div>
  );
}
