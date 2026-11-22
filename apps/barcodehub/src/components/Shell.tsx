import { NavLink, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, ScanBarcode } from 'lucide-react';
import { logout } from '../lib/auth';
import { cn } from '@project/components/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

export default function Shell({
  title,
  logo,
  nav,
  footer,
  signOutTo = '/login',
  children,
}: {
  title: string;
  logo?: string | null;
  nav: NavItem[];
  footer?: ReactNode;
  signOutTo?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex bg-background">
      {/* Sticky: on desktop the sidebar fills the viewport height and stays put while the page scrolls;
          on phones it is the top nav bar and stays pinned to the top. */}
      <aside className="no-print sticky top-0 z-30 md:w-64 md:h-screen md:shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex md:flex-col shadow-sm">
        <Link to="/" className="hidden md:flex items-center gap-3 px-5 h-16 font-bold text-white border-b border-sidebar-border/60">
          {logo ? (
            <img src={logo} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10" />
          ) : (
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <ScanBarcode className="w-4 h-4" />
            </span>
          )}
          <span className="truncate tracking-tight font-semibold">{title}</span>
        </Link>
        <nav className="flex md:flex-col gap-1.5 p-2 md:p-3 overflow-x-auto md:overflow-x-visible md:overflow-y-auto flex-1 min-h-0">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-white font-semibold shadow-sm'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white'
                )
              }
            >
              <n.icon className="w-4 h-4 shrink-0" />
              <span>{n.label}</span>
              {!!n.badge && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-sidebar-primary text-sidebar-primary-foreground">
                  {n.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block p-3 border-t border-sidebar-border/60 space-y-1">
          {footer}
          <button
            onClick={() => logout(signOutTo)}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-background">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  badge,
  actions,
}: {
  title: string;
  sub?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div className="group relative p-5 bg-card hover:bg-card/90 border border-border/80 hover:border-primary/40 rounded-2xl shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-muted-foreground transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl md:text-3xl font-bold tracking-tight mt-2 text-foreground">{value}</div>
      {(hint || trend) && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                'font-semibold px-1.5 py-0.5 rounded-md text-[11px]',
                trend.positive !== false
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {trend.value}
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </div>
  );
}
