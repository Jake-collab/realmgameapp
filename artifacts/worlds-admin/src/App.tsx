import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
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
  MediaRetentionPage,
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

function AccessState({ message, loading = false }: { message: string; loading?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }} data-testid="admin-access-state">
      <div style={{ width: 'min(420px, 100%)', textAlign: 'center', padding: 32, borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
        {!loading && <AlertTriangle style={{ width: 22, color: 'hsl(24 71% 41%)', marginBottom: 14 }} />}
        <h1 style={{ margin: '0 0 10px', fontSize: 20 }}>{loading ? 'Checking staff access…' : 'Staff access required'}</h1>
        <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  );
}

function Router() {
  const [mediaRetentionPage, setMediaRetentionPage] = useState(1);
  const data = useAdminData(mediaRetentionPage);
  const session = data.session.data;
  if (data.session.isLoading) {
    return <AccessState loading message="We’re verifying your approved Worlds staff account." />;
  }
  if (data.session.isError) {
    return <AccessState message="The staff session could not be verified. Try again after the admin API is available." />;
  }
  if (!session?.authenticated || !session.authorized) {
    return <AccessState message={session?.reason || 'Sign in with an approved Worlds staff account to continue.'} />;
  }
  return (
    <RoutedErrorBoundary>
      <AdminShell session={session}>
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
          <Route path="/moderation/media-retention"><MediaRetentionPage data={data} page={mediaRetentionPage} onPageChange={setMediaRetentionPage} /></Route>
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