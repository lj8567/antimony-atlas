'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ConfidenceIndicator, ProvenanceBadge } from '@/components/ui/badges';
import { SearchField, SelectField } from '@/components/ui/controls';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState } from '@/components/ui/states';
import { toQueryString } from '@/lib/filters';
import { formatDate } from '@/lib/format';
import type { SourceListItem } from '@/lib/supabase/types';

interface SourceFilters {
  q: string;
  publisher: string;
  type: string;
  year: string;
  node: string;
  provenance: string;
}

export function SourceExplorer({ sources }: { sources: SourceListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters: SourceFilters = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return {
      q: params.get('q') ?? '',
      publisher: params.get('publisher') ?? '',
      type: params.get('type') ?? '',
      year: params.get('year') ?? '',
      node: params.get('node') ?? '',
      provenance: params.get('provenance') ?? '',
    };
  }, [searchParams]);

  const apply = (patch: Partial<SourceFilters>) => {
    const next = { ...filters, ...patch };
    router.replace(`${pathname}${toQueryString({ ...next })}`, { scroll: false });
  };

  const options = useMemo(() => {
    const publishers = [...new Set(sources.map((source) => source.publisher))].sort().map((publisher) => ({
      value: publisher,
      label: publisher,
    }));
    const types = [...new Set(sources.map((source) => source.source_type))].sort().map((type) => ({
      value: type,
      label: type,
    }));
    const years = [...new Set(sources.map((source) => (source.publication_date ?? '').slice(0, 4)).filter(Boolean))]
      .sort()
      .reverse()
      .map((year) => ({ value: year, label: year }));
    const nodeMap = new Map<string, string>();
    for (const source of sources) {
      for (const assertion of source.assertions) {
        for (const na of assertion.node_assertions) {
          if (na.node) nodeMap.set(na.node.node_id, na.node.canonical_name);
        }
      }
    }
    const nodes = [...nodeMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return { publishers, types, years, nodes };
  }, [sources]);

  const filtered = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return sources.filter((source) => {
      if (filters.publisher && source.publisher !== filters.publisher) return false;
      if (filters.type && source.source_type !== filters.type) return false;
      if (filters.year && !(source.publication_date ?? '').startsWith(filters.year)) return false;
      if (filters.node) {
        const supportsNode = source.assertions.some((assertion) =>
          assertion.node_assertions.some((na) => na.node?.node_id === filters.node),
        );
        if (!supportsNode) return false;
      }
      if (filters.provenance) {
        if (!source.assertions.some((assertion) => assertion.provenance === filters.provenance)) return false;
      }
      if (query) {
        const haystack = `${source.title} ${source.publisher}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [sources, filters]);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section className="panel">
      <div className="filter-bar">
        <SearchField value={filters.q} placeholder="Title or publisher…" onChange={(q) => apply({ q })} />
        <SelectField label="Publisher" value={filters.publisher} options={options.publishers} onChange={(publisher) => apply({ publisher })} />
        <SelectField label="Type" value={filters.type} options={options.types} onChange={(type) => apply({ type })} />
        <SelectField label="Year" value={filters.year} options={options.years} onChange={(year) => apply({ year })} />
        <SelectField label="Linked asset" value={filters.node} options={options.nodes} onChange={(node) => apply({ node })} />
        <SelectField
          label="Provenance"
          value={filters.provenance}
          options={[
            { value: 'reported', label: 'Reported' },
            { value: 'modelled', label: 'Modelled' },
            { value: 'unverified', label: 'Unverified' },
          ]}
          onChange={(provenance) => apply({ provenance })}
        />
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => router.replace(pathname, { scroll: false })}>
            Clear all
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={sources.length === 0 ? 'No sources registered yet' : 'No sources match the current filters'}
          detail={
            sources.length === 0
              ? 'Every claim in the atlas must trace to a registered source; the register appears here as research proceeds.'
              : 'Relax or clear filters to see more sources.'
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Publisher</th>
                <th>Type</th>
                <th>Published</th>
                <th>Retrieved</th>
                <th className="num">Supports</th>
                <th>
                  <span className="visually-hidden">Expand</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((source) => {
                const isOpen = expanded === source.source_id;
                const nodeNames = [
                  ...new Map(
                    source.assertions.flatMap((assertion) =>
                      assertion.node_assertions
                        .filter((na) => na.node)
                        .map((na) => [na.node!.node_id, na.node!.canonical_name] as const),
                    ),
                  ).entries(),
                ];
                return (
                  <SourceRowPair
                    key={source.source_id}
                    source={source}
                    nodeNames={nodeNames}
                    isOpen={isOpen}
                    onToggle={() => setExpanded(isOpen ? null : source.source_id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">
        <span>
          {filtered.length} of {sources.length} sources
        </span>
      </div>
    </section>
  );
}

function SourceRowPair({
  source,
  nodeNames,
  isOpen,
  onToggle,
}: {
  source: SourceListItem;
  nodeNames: Array<readonly [string, string]>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr>
        <td className="primary-cell" style={{ maxWidth: 380, whiteSpace: 'normal' }}>
          <SourceLink url={source.url} title={source.title} className="row-link" />
          {source.licence && <span className="cell-sub">Licence: {source.licence}</span>}
        </td>
        <td>{source.publisher}</td>
        <td>{source.source_type}</td>
        <td>{formatDate(source.publication_date)}</td>
        <td>{formatDate(source.retrieved_at)}</td>
        <td className="num">
          {source.assertions.length} claim{source.assertions.length === 1 ? '' : 's'}
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
            {nodeNames.length > 0 && (
              <p className="note" style={{ margin: '4px 0 8px' }}>
                Linked assets:{' '}
                {nodeNames.map(([nodeId, name], index) => (
                  <span key={nodeId}>
                    {index > 0 && ', '}
                    <Link href={`/assets/${nodeId}`}>{name}</Link>
                  </span>
                ))}
              </p>
            )}
            {source.assertions.length === 0 ? (
              <p className="note" style={{ margin: '4px 0' }}>
                No assertions extracted from this source yet.
              </p>
            ) : (
              <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)' }}>
                {source.assertions.map((assertion) => (
                  <li key={assertion.assertion_id} style={{ marginBottom: 7, maxWidth: 720, whiteSpace: 'normal' }}>
                    “{assertion.claim_text}”
                    <span className="inline-list" style={{ marginTop: 3 }}>
                      <ProvenanceBadge provenance={assertion.provenance} withHint={false} />
                      <ConfidenceIndicator score={assertion.confidence_score} withHint={false} />
                      {assertion.node_assertions.map((na, index) => (
                        <span key={index} className="chip">
                          {na.field_name}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
