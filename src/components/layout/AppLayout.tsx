import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutTemplate, Wrench, ScanSearch, Rocket, LogOut, Megaphone, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/builder', label: 'Campaign Builder', icon: Wrench },
  { to: '/ads-processing', label: 'Ads Processing', icon: ScanSearch },
  { to: '/bulk-uploader', label: 'Bulk Uploader', icon: Rocket },
];

const STORAGE_KEY = 'sidebar:collapsed';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  // Keyboard shortcut: Cmd/Ctrl + B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed(c => !c);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden">
      <aside
        className={cn(
          'bg-card border-r border-border/50 flex flex-col py-6 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out shrink-0',
          collapsed ? 'w-[68px] px-2' : 'w-64 px-4'
        )}
      >
        {/* Brand + Toggle (same row when expanded, stacked when collapsed) */}
        <div className={cn('mb-8 flex', collapsed ? 'flex-col items-center gap-2 px-0' : 'items-center px-2')}>
          <div className={cn('flex items-center gap-3 min-w-0', collapsed && 'gap-0')}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className={cn('overflow-hidden transition-all duration-300', collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
              <h1 className="text-lg font-bold text-foreground tracking-tight whitespace-nowrap">AdOps Studio</h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest whitespace-nowrap">by BrandPeak</p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 shrink-0',
              !collapsed && 'ml-auto'
            )}
            title={collapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl text-sm transition-all duration-200',
                  collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold border-r-4 border-primary rounded-r-none'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={cn('tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap', collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="mt-auto">
          <div className="border-t border-border/50 pt-2">
            <div className={cn('px-4 py-2 text-xs text-muted-foreground truncate transition-all duration-300', collapsed ? 'opacity-0 h-0 py-0 overflow-hidden' : 'opacity-100')}>
              {user?.email}
            </div>
            <button
              onClick={signOut}
              title={collapsed ? 'Sign out' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 w-full',
                collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={cn('transition-all duration-300 overflow-hidden whitespace-nowrap', collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
