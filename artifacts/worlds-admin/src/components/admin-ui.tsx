import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Info, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import type { AdminDiagnostic, AdminMetric, AdminQueueItem } from '@workspace/api-client-react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

export function RefreshButton({ onClick, loading = false, testId = 'button-refresh-data' }: { onClick: () => void; loading?: boolean; testId?: string }) {
  return <button className="btn btn-quiet" onClick={onClick} disabled={loading} data-testid={testId}><RefreshCw className={loading ? 'animate-spin' : ''} /> {loading ? 'Checking' : 'Refresh'}</button>;
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ['healthy', 'configured', 'approved', 'published', 'active', 'success', 'resolved'].includes(normalized)
    ? 'green'
    : ['failed', 'rejected', 'critical', 'blocked', 'suspended'].includes(normalized)
      ? 'red'
      : ['degraded', 'pending_review', 'pending', 'scheduled', 'paused', 'review'].includes(normalized)
        ? 'orange'
        : 'blue';
  return <span className={`tag ${tone}`} data-testid={`status-${normalized}`}>{status.replace(/_/g, ' ')}</span>;
}

export function UnavailableState({ message = 'The API did not return this dataset yet.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" data-testid="state-unavailable">
      <CircleDashed />
      <strong>Data currently unavailable</strong>
      <p>{message} This is a live connection state, not an empty result. Check diagnostics or try again.</p>
      {onRetry && <button className="btn btn-quiet" style={{ marginTop: 16 }} onClick={onRetry} data-testid="button-retry-data"><RefreshCw /> Retry connection</button>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="empty-state" data-testid="state-error">
      <AlertTriangle style={{ color: 'hsl(var(--destructive))' }} />
      <strong>Could not load this view</strong>
      <p>The request failed before returning a safe result. Retry when the API is reachable.</p>
      {onRetry && <button className="btn btn-quiet" style={{ marginTop: 16 }} onClick={onRetry} data-testid="button-retry-error"><RefreshCw /> Try again</button>}
    </div>
  );
}

export function MetricGrid({ metrics, loading }: { metrics?: AdminMetric[]; loading?: boolean }) {
  if (loading) {
    return <div className="metrics-grid">{[1, 2, 3, 4].map((item) => <div className="metric-card" key={item}><div className="skeleton" style={{ height: 12, width: '55%' }} /><div className="skeleton" style={{ height: 31, width: '34%', marginTop: 15 }} /></div>)}</div>;
  }
  return (
    <div className="metrics-grid" data-testid="grid-dashboard-metrics">
      {(metrics || []).map((metric) => (
        <div className="metric-card hover-elevate" key={metric.label} data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className="metric-label">{metric.label}</div>
          {metric.status === 'unavailable' || metric.value === null ? <div className="metric-unavailable">Unavailable</div> : <div className="metric-value">{metric.value.toLocaleString()}</div>}
          {metric.detail && <div className="metric-detail">{metric.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export function QueueList({ items, loading, onRetry }: { items?: AdminQueueItem[]; loading?: boolean; onRetry?: () => void }) {
  if (loading) return <div>{[1, 2, 3].map((item) => <div className="queue-row" key={item}><div className="skeleton" style={{ width: 31, height: 31 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 12, width: '65%' }} /><div className="skeleton" style={{ height: 9, width: '35%', marginTop: 8 }} /></div></div>)}</div>;
  if (!items) return <UnavailableState onRetry={onRetry} />;
  if (!items.length) return <div className="empty-state" data-testid="state-queue-empty"><CheckCircle2 /><strong>Queue is clear</strong><p>No action items are waiting for staff attention.</p></div>;
  return <div data-testid="list-action-queue">{items.map((item) => <Link className="queue-row" href={item.href} key={item.id} data-testid={`queue-item-${item.id}`}><div className={`queue-mark ${item.priority}`}><Info style={{ width: 15 }} /></div><div className="queue-copy"><div className="queue-title">{item.title}</div><div className="queue-meta">{item.category}{item.age ? ` · ${item.age}` : ''}</div></div><span className={`priority priority-${item.priority}`}>{item.priority}</span></Link>)}</div>;
}

export function DiagnosticsList({ checks, loading, onRetry }: { checks?: AdminDiagnostic[]; loading?: boolean; onRetry?: () => void }) {
  if (loading) return <div className="diagnostic-grid">{[1, 2, 3, 4].map((item) => <div className="diagnostic" key={item}><div className="skeleton" style={{ height: 13, width: '45%' }} /><div className="skeleton" style={{ height: 30, width: '90%', marginTop: 14 }} /></div>)}</div>;
  if (!checks) return <div className="panel"><UnavailableState onRetry={onRetry} /></div>;
  if (!checks.length) return <div className="panel"><UnavailableState message="No diagnostic checks were returned by the platform." onRetry={onRetry} /></div>;
  return <div className="diagnostic-grid" data-testid="grid-diagnostics">{checks.map((check) => <div className="diagnostic hover-elevate" key={check.name} data-testid={`diagnostic-${check.name.toLowerCase().replace(/\s+/g, '-')}`}><div className="diagnostic-head"><div className="diagnostic-name">{check.name}</div><StatusBadge status={check.status} /></div><div className="diagnostic-summary">{check.summary}</div><div className="diagnostic-time mono">{check.checkedAt ? new Date(check.checkedAt).toLocaleString() : 'Not checked'}</div></div>)}</div>;
}