import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutTemplate, Wrench, ScanSearch, Rocket, LogOut, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/builder', label: 'Campaign Builder', icon: Wrench },
  { to: '/ads-processing', label: 'Ads Processing', icon: ScanSearch },
  { to: '/bulk-uploader', label: 'Bulk Uploader', icon: Rocket },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className="w-64 bg-card border-r border-border/50 flex flex-col py-6 px-4 overflow-y-auto">
        {/* Brand */}
        <div className="mb-8 px-2 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">AdOps Studio</h1>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">by BrandPeak</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold border-r-4 border-primary rounded-r-none'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="tracking-tight">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="mt-auto">
          <div className="border-t border-border/50 pt-2">
            <div className="px-4 py-2 text-xs text-muted-foreground truncate">
              {user?.email}
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 w-full"
            >
              <LogOut className="w-4 h-4" />
              Sign out
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
