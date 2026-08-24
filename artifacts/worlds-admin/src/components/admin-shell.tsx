import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bell,
  ChevronDown,
  ClipboardCheck,
  FileClock,
  Flag,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Menu,
  Orbit,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { AdminSession } from '@workspace/api-client-react';

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: 'Workspace', items: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'Operations',
    items: [
      { href: '/users', label: 'Users', icon: Users, permission: 'admin.users.read' },
      { href: '/quests', label: 'Quests', icon: Target, permission: 'admin.quests.read' },
      { href: '/hunts', label: 'Hunts', icon: Orbit },
      { href: '/interests', label: 'Interests', icon: Sparkles },
      { href: '/achievements', label: 'Achievements', icon: Trophy },
    ],
  },
  {
    label: 'AI studio',
    items: [
      { href: '/ai', label: 'AI overview', icon: Sparkles, permission: 'ai.read' },
      { href: '/ai/prompts', label: 'Prompt templates', icon: FileClock, permission: 'ai.prompts.read' },
      { href: '/ai/generate', label: 'Generate Quests', icon: Target, permission: 'ai.generate' },
      { href: '/ai/settings', label: 'AI settings', icon: Settings, permission: 'ai.settings.read' },
    ],
  },
  {
    label: 'Review & safety',
    items: [
      { href: '/quests/submissions', label: 'Proof review', icon: ClipboardCheck, permission: 'admin.review.read' },
      { href: '/moderation/media', label: 'Media moderation', icon: ListChecks, permission: 'moderation.read' },
      { href: '/moderation/reports', label: 'Reports', icon: Flag, permission: 'moderation.read' },
      { href: '/moderation/anti-cheat', label: 'Anti-cheat', icon: ShieldCheck, permission: 'integrity.read' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/audit', label: 'Audit log', icon: FileClock, permission: 'admin.audit.read' },
      { href: '/diagnostics', label: 'Diagnostics', icon: Gauge, permission: 'admin.diagnostics.read' },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function initials(name?: string | null, username?: string | null) {
  const source = name || username || 'Staff';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function AdminShell({
  children,
  session,
}: {
  children: ReactNode;
  session?: AdminSession;
}) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const current = location === '/' ? '/dashboard' : location;
  const displayName = session?.displayName || session?.username || 'Staff operator';

  return (
    <div className="app-shell">
      {open && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} data-testid="button-close-navigation" />}
      <aside className={`sidebar ${open ? 'open' : ''}`} data-testid="sidebar-navigation">
        <div className="wordmark">
          <div className="brand-mark">W</div>
          <div>
            <div className="wordmark-title">Worlds</div>
            <span className="wordmark-subtitle">staff operations</span>
          </div>
          <button className="mobile-menu-button" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-sidebar-close">
            <X />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = current === item.href || (item.href !== '/dashboard' && current.startsWith(`${item.href}/`));
                if (item.permission && !session?.authorized && !session?.permissions.includes(item.permission)) return null;
                if (item.permission && session?.authorized && !session.permissions.includes(item.permission)) return null;
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                    data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className="status-dot" />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{session?.authorized ? 'Console online' : 'Access unavailable'}</div>
              <div style={{ color: 'hsl(var(--sidebar-foreground) / .45)', fontSize: 10, marginTop: 2 }}>{session?.authorized ? 'Operational data queried live' : 'Staff session required'}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid hsl(var(--sidebar-border))', marginTop: 15, paddingTop: 13, display: 'flex', gap: 9, alignItems: 'center' }}>
            <div className="avatar" style={{ width: 27, height: 27, background: 'hsl(var(--sidebar-accent))', color: 'hsl(var(--sidebar-foreground))' }}>{initials(session?.displayName, session?.username)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="text-session-name">{displayName}</div>
              <div style={{ color: 'hsl(var(--sidebar-foreground) / .45)', font: '9px var(--app-font-mono)', textTransform: 'uppercase', marginTop: 3 }} data-testid="text-session-role">{session?.role?.replace('_', ' ') || 'operator'}</div>
            </div>
            <ChevronDown style={{ width: 13, marginLeft: 'auto', opacity: .45 }} />
          </div>
        </div>
      </aside>
      <div className="main-frame">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu /></button>
            <div className="topbar-search" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
              <span className="mono" style={{ fontSize: 10, border: '1px solid hsl(var(--border))', borderRadius: 4, padding: '3px 5px', marginRight: 7 }}>K</span>
              Quick find
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
            <Link href="/diagnostics" className="topbar-search" style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 11 }} data-testid="link-system-status">
              <span className="status-dot" style={{ width: 6, height: 6 }} /> System status
            </Link>
            <Link href="/settings" aria-label="Open settings" style={{ color: 'hsl(var(--muted-foreground))' }} data-testid="link-topbar-settings"><Settings style={{ width: 17 }} /></Link>
            <div style={{ width: 1, height: 20, background: 'hsl(var(--border))' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="avatar" style={{ width: 29, height: 29 }}>{initials(session?.displayName, session?.username)}</div>
              <span className="topbar-search" style={{ fontSize: 12, fontWeight: 600 }} data-testid="text-topbar-user">{displayName}</span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}