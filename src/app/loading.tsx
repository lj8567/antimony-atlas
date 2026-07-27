import { TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="page">
      <div className="skeleton" style={{ height: 22, width: 260, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 13, width: 420, marginBottom: 22 }} />
      <div className="panel">
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
