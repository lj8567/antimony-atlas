import { AssetMap } from '@/components/AssetMap';
import { getPublicNodes } from '@/lib/nodes';

export default async function HomePage() {
  const nodes = await getPublicNodes();
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">ANTIMONY PILOT</p>
        <h1>Supply Risk Atlas</h1>
        <p>Source-audited mines, projects, processing facilities and gateways. Missing data is shown, not hidden.</p>
      </header>
      <section className="metrics">
        <article><strong>{nodes.length}</strong><span>mapped nodes</span></article>
        <article><strong>{nodes.filter(n => n.provenance_class === 'reported').length}</strong><span>reported</span></article>
        <article><strong>{new Set(nodes.map(n => n.country_code)).size}</strong><span>countries</span></article>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Asset map</h2><span>Click a node for evidence status</span></div>
        <AssetMap nodes={nodes} />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Asset register</h2><span>Initial pilot dataset</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Asset</th><th>Type</th><th>Country</th><th>Status</th><th>Provenance</th><th>Confidence</th></tr></thead>
            <tbody>{nodes.map(node => (
              <tr key={node.node_id}>
                <td>{node.canonical_name}</td><td>{node.node_type}</td><td>{node.country_code}</td><td>{node.status}</td>
                <td><span className={`badge ${node.provenance_class}`}>{node.provenance_class}</span></td><td>{node.confidence_score}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
