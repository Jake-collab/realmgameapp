import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminShell } from '@/components/admin-shell';
import { useAdminData } from '@/hooks/use-admin-data';
import {
  AuditPage,
  DashboardPage,
  DiagnosticsPage,
  OperationsPage,
  QuestsPage,
  SettingsPage,
  UsersPage,
  AIPage,
} from '@/pages/console-pages';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function HomeRedirect() {
  return <Redirect to="/dashboard" />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AccessNotice({ data }: { data: ReturnType<typeof useAdminData> }) {
  const session = data.session.data;
  if (data.session.isLoading || (!data.session.isError && session?.authenticated && session.authorized)) return null;
  const message = data.session.isError
    ? 'Staff session could not be resolved. Data requests may remain unavailable until the API is connected.'
    : session?.reason || 'This account is not authorized for the staff console.';
  return (
    <div style={{ margin: '18px 32px 0', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 7, border: '1px solid hsl(var(--accent) / .35)', background: 'hsl(var(--accent) / .10)', color: 'hsl(var(--foreground))', fontSize: 12 }} data-testid="notice-session-state">
      <AlertTriangle style={{ width: 16, color: 'hsl(24 71% 41%)', flex: '0 0 auto' }} />
      <span>{message}</span>
      <Link href="/diagnostics" style={{ marginLeft: 'auto', color: 'hsl(24 71% 36%)', fontWeight: 700, whiteSpace: 'nowrap' }} data-testid="link-session-diagnostics">Open diagnostics</Link>
    </div>
  );
}

function Router() {
  const data = useAdminData();
  return (
    <RoutedErrorBoundary>
      <AdminShell session={data.session.data}>
        <AccessNotice data={data} />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/dashboard"><DashboardPage data={data} /></Route>
          <Route path="/users"><UsersPage data={data} /></Route>
          <Route path="/quests"><QuestsPage data={data} /></Route>
          <Route path="/quests/daily"><OperationsPage data={data} /></Route>
          <Route path="/quests/monthly"><OperationsPage data={data} /></Route>
          <Route path="/quests/geo"><OperationsPage data={data} /></Route>
          <Route path="/quests/submissions"><OperationsPage data={data} /></Route>
          <Route path="/ai"><AIPage data={data} /></Route>
          <Route path="/ai/prompts"><AIPage data={data} /></Route>
          <Route path="/ai/generate"><AIPage data={data} /></Route>
          <Route path="/ai/settings"><AIPage data={data} /></Route>
          <Route path="/hunts"><OperationsPage data={data} /></Route>
          <Route path="/moderation/media"><OperationsPage data={data} /></Route>
          <Route path="/moderation/reports"><OperationsPage data={data} /></Route>
          <Route path="/moderation/anti-cheat"><OperationsPage data={data} /></Route>
          <Route path="/interests"><OperationsPage data={data} /></Route>
          <Route path="/achievements"><OperationsPage data={data} /></Route>
          <Route path="/notifications"><OperationsPage data={data} /></Route>
          <Route path="/settings"><SettingsPage data={data} /></Route>
          <Route path="/audit"><AuditPage data={data} /></Route>
          <Route path="/diagnostics"><DiagnosticsPage data={data} /></Route>
          <Route component={NotFound} />
        </Switch>
      </AdminShell>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;