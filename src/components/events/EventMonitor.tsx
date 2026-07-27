'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SeverityIndicator } from '@/components/ui/badges';
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
import { formatDate, formatEventType, formatSeverity } from '@/lib/format';
import type { EventDetail } from '@/lib/supabase/types';

const CSV_COLUMNS: CsvColumn<EventDetail>[] = [
  { label: 'Date', value: (event) => formatDate(event.event_date, '') },
  { label: 'Title', value: (event) => event.title },
  { label: 'Event type', value: (event) => formatEventType(event.event_type) },
  { label: 'Severity (1-5)', value: (event) => event.severity },
  { label: 'Severity label', value: (event) => formatSeverity(event.severity) },
  { label: 'Affected asset', value: (event) => event.node?.name ?? '' },
  { label: 'Country code', value: (event) => event.node?.country_code ?? '' },
  { label: 'Country', value: (event) => (event.node?.country_code ? countryName(event.node.country_code) : '') },
  { label: 'Summary', value: (event) => event.summary },
  { label: 'Source', value: (event) => event.source?.title ?? '' },
  { label: 'Source URL', value: (event) => event.source?.url ?? '' },
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
    const types = [...new Set(events.map((event) => event.event_type).filter((t): t is string => Boolean(t)))]
      .sort()
      .map((type) => ({ value: type, label: formatEventType(type) }));
    const countries = [
      ...new Set(events.map((event) => event.node?.country_code).filter((c): c is string => Boolean(c))),
    ]
      .sort((a, b) => countryName(a).localeCompare(countryName(b)))
      .map((code) => ({ value: code, label: countryName(code) }));
    const years = [...new Set(events.map((event) => (event.event_date ?? '').slice(0, 4)).filter(Boolean))]
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
        <SearchField value={filters.q} placeholder="Title, summary, asset…" onChange={(q) => apply({ q })} />
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
              ? 'Ownership changes, commissioning milestones, suspensions and other material events appear here once researched.'
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
                <th>Affected asset</th>
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
        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(event.event_date)}</td>
        <td className="primary-cell" style={{ maxWidth: 380, whiteSpace: 'normal' }}>
          {event.title}
        </td>
        <td>{formatEventType(event.event_type)}</td>
        <td>
          <SeverityIndicator severity={event.severity} />
        </td>
        <td>
          {event.node ? (
            <>
              <Link href={`/assets/${event.node.node_id}`}>{event.node.name}</Link>
              <span className="cell-sub">{countryName(event.node.country_code)}</span>
            </>
          ) : (
            <span className="note">None linked</span>
          )}
        </td>
        <td>
          {event.source ? (
            <SourceLink url={event.source.url} title={event.source.publisher ?? event.source.title} />
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
              {event.summary ? (
                <p style={{ margin: '4px 0 8px', fontSize: 12.5, color: 'var(--ink-2)' }}>{event.summary}</p>
              ) : (
                <p className="note" style={{ margin: '4px 0 8px' }}>
                  No further summary recorded.
                </p>
              )}
              {event.source && (
                <p className="note" style={{ margin: 0 }}>
                  Source: <SourceLink url={event.source.url} title={event.source.title} />
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
