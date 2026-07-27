'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ConfidenceIndicator, ProvenanceBadge, SeverityIndicator } from '@/components/ui/badges';
import { SearchField, SelectField } from '@/components/ui/controls';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import type { CsvColumn } from '@/lib/csv';
import {
  filterEvents,
  parseEventFilters,
  serializeEventFilters,
  toQueryString,
  type EventFilters,
} from '@/lib/filters';
import { formatDate, formatEventType, formatSeverity, PROVENANCE_LABEL } from '@/lib/format';
import type { EventDetail } from '@/lib/supabase/types';

const CSV_COLUMNS: CsvColumn<EventDetail>[] = [
  { label: 'Date', value: (event) => formatDate(event.announced_at, '') },
  { label: 'Headline', value: (event) => event.headline },
  { label: 'Event type', value: (event) => formatEventType(event.event_type) },
  { label: 'Severity (1-5)', value: (event) => event.severity },
  { label: 'Severity label', value: (event) => formatSeverity(event.severity) },
  { label: 'Country code', value: (event) => event.country_code },
  { label: 'Country', value: (event) => (event.country_code ? countryName(event.country_code) : '') },
  {
    label: 'Affected nodes',
    value: (event) => event.impacts.map((impact) => impact.node?.canonical_name).filter(Boolean).join('; '),
  },
  { label: 'Description', value: (event) => event.description },
  { label: 'Effective from', value: (event) => event.effective_from },
  { label: 'Effective to', value: (event) => event.effective_to },
  { label: 'Provenance', value: (event) => (event.assertion ? PROVENANCE_LABEL[event.assertion.provenance] : '') },
  { label: 'Confidence (0-100)', value: (event) => event.assertion?.confidence_score },
  { label: 'Source', value: (event) => event.assertion?.source?.title ?? '' },
  { label: 'Source URL', value: (event) => event.assertion?.source?.url ?? '' },
];

export function EventMonitor({ events }: { events: EventDetail[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = useMemo(() => parseEventFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const apply = (patch: Partial<EventFilters>) => {
    const next = { ...filters, ...patch };
    router.replace(`${pathname}${toQueryString(serializeEventFilters(next))}`, { scroll: false });
  };

  const options = useMemo(() => {
    const types = [...new Set(events.map((event) => event.event_type))].sort().map((type) => ({
      value: type,
      label: formatEventType(type),
    }));
    const countries = [
      ...new Set(
        events.flatMap((event) => [
          ...(event.country_code ? [event.country_code] : []),
          ...event.impacts.map((impact) => impact.node?.country_code).filter((c): c is string => Boolean(c)),
        ]),
      ),
    ]
      .sort((a, b) => countryName(a).localeCompare(countryName(b)))
      .map((code) => ({ value: code, label: countryName(code) }));
    const years = [...new Set(events.map((event) => (event.announced_at ?? '').slice(0, 4)).filter(Boolean))]
      .sort()
      .reverse()
      .map((year) => ({ value: year, label: year }));
    return { types, countries, years };
  }, [events]);

  const filtered = useMemo(() => filterEvents(events, filters), [events, filters]);
  const hasFilters = Object.values(serializeEventFilters(filters)).some(Boolean);

  return (
    <section className="panel">
      <div className="filter-bar">
        <SearchField value={filters.q} placeholder="Headline, description, asset…" onChange={(q) => apply({ q })} />
        <SelectField label="Type" value={filters.type} options={options.types} onChange={(type) => apply({ type })} />
        <SelectField label="Country" value={filters.country} options={options.countries} onChange={(country) => apply({ country })} />
        <SelectField
          label="Min severity"
          value={filters.minSeverity}
          options={[5, 4, 3, 2, 1].map((severity) => ({
            value: String(severity),
            label: `${severity} — ${formatSeverity(severity)}`,
          }))}
          allLabel="Any"
          onChange={(minSeverity) => apply({ minSeverity })}
        />
        <SelectField label="Year" value={filters.year} options={options.years} onChange={(year) => apply({ year })} />
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => router.replace(pathname, { scroll: false })}>
            Clear all
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ExportCsvButton
            filename="antimony-atlas-events.csv"
            title="Event monitor (filtered)"
            columns={CSV_COLUMNS}
            rows={filtered}
            filters={Object.fromEntries(Object.entries(serializeEventFilters(filters)).filter(([, v]) => v))}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={events.length === 0 ? 'No events recorded yet' : 'No events match the current filters'}
          detail={
            events.length === 0
              ? 'Export controls, suspensions, permits, accidents and other material events appear here once researched.'
              : 'Relax or clear filters to see more events.'
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Affected</th>
                <th>Source</th>
                <th>
                  <span className="visually-hidden">Expand</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => {
                const isOpen = expanded === event.event_id;
                return (
                  <EventRows
                    key={event.event_id}
                    event={event}
                    isOpen={isOpen}
                    onToggle={() => setExpanded(isOpen ? null : event.event_id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">
        <span>
          {filtered.length} of {events.length} events
        </span>
      </div>
    </section>
  );
}

function EventRows({ event, isOpen, onToggle }: { event: EventDetail; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr>
        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(event.announced_at)}</td>
        <td className="primary-cell" style={{ maxWidth: 380, whiteSpace: 'normal' }}>
          {event.headline}
          {event.country_code && <span className="cell-sub">{countryName(event.country_code)}</span>}
        </td>
        <td>{formatEventType(event.event_type)}</td>
        <td>
          <SeverityIndicator severity={event.severity} />
        </td>
        <td>
          {event.impacts.length === 0 ? (
            <span className="note">None linked</span>
          ) : (
            <span className="inline-list">
              {event.impacts.map((impact, index) =>
                impact.node ? (
                  <Link key={index} href={`/assets/${impact.node.node_id}`}>
                    {impact.node.canonical_name}
                  </Link>
                ) : (
                  <span key={index} className="note">
                    Route/edge
                  </span>
                ),
              )}
            </span>
          )}
        </td>
        <td>
          {event.assertion?.source ? (
            <SourceLink url={event.assertion.source.url} title={event.assertion.source.publisher} />
          ) : (
            <span className="note">Missing source</span>
          )}
        </td>
        <td>
          <button type="button" className="btn btn-ghost" onClick={onToggle} aria-expanded={isOpen}>
            {isOpen ? 'Hide' : 'Detail'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--surface-2)' }}>
            <div style={{ maxWidth: 760, whiteSpace: 'normal' }}>
              {event.description ? (
                <p style={{ margin: '4px 0 8px', fontSize: 12.5, color: 'var(--ink-2)' }}>{event.description}</p>
              ) : (
                <p className="note" style={{ margin: '4px 0 8px' }}>
                  No further description recorded.
                </p>
              )}
              <div className="inline-list" style={{ marginBottom: 6 }}>
                {event.assertion && <ProvenanceBadge provenance={event.assertion.provenance} />}
                {event.assertion && <ConfidenceIndicator score={event.assertion.confidence_score} />}
                {event.effective_from && (
                  <span className="note">
                    Effective {formatDate(event.effective_from)}
                    {event.effective_to ? ` – ${formatDate(event.effective_to)}` : ''}
                  </span>
                )}
              </div>
              {event.impacts.length > 0 && (
                <p className="note" style={{ margin: 0 }}>
                  Impacts:{' '}
                  {event.impacts
                    .map((impact) =>
                      [
                        impact.node?.canonical_name ?? 'edge',
                        impact.impact_type,
                        impact.impact_direction ?? undefined,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    )
                    .join('; ')}
                </p>
              )}
              {event.assertion?.claim_text && (
                <p className="note" style={{ margin: '6px 0 0' }}>
                  Source claim: “{event.assertion.claim_text}”
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
