'use client';

import { useState } from 'react';
import { ConfidenceIndicator, ProvenanceBadge } from '@/components/ui/badges';
import { Drawer } from '@/components/ui/Drawer';
import { SourceLink } from '@/components/ui/SourceLink';
import { formatDate } from '@/lib/format';
import type { AssetSourceEntry } from './collect-sources';

/**
 * "Sources (n)" trigger plus the side drawer listing each source and the
 * claims it supports, without navigating away from the asset.
 */
export function SourcesDrawerButton({ entries, assetName }: { entries: AssetSourceEntry[]; assetName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} disabled={entries.length === 0}>
        Sources ({entries.length})
      </button>
      <Drawer open={open} title={`Sources — ${assetName}`} onClose={() => setOpen(false)}>
        {entries.length === 0 ? (
          <p className="note">No sources recorded for this asset yet.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.source.source_id} className="source-card">
              <h4>
                <SourceLink url={entry.source.url} title={entry.source.title} />
              </h4>
              <p className="source-meta">
                {entry.source.publisher} · {entry.source.source_type} · Published{' '}
                {formatDate(entry.source.publication_date)}
                {entry.source.licence ? ` · ${entry.source.licence}` : ''}
              </p>
              <div style={{ marginTop: 8 }}>
                <p className="source-meta" style={{ marginBottom: 4 }}>
                  Supports {entry.supports.length} claim{entry.supports.length === 1 ? '' : 's'}:
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {entry.supports.map((claim, index) => (
                    <li key={index} style={{ marginBottom: 5 }}>
                      <span className="note">{claim.kind}:</span> {claim.label}
                      {claim.reference ? <span className="note"> ({claim.reference})</span> : null}
                      <span className="inline-list" style={{ marginTop: 2 }}>
                        <ProvenanceBadge provenance={claim.provenance} withHint={false} />
                        <ConfidenceIndicator score={claim.confidence} withHint={false} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        )}
      </Drawer>
    </>
  );
}
