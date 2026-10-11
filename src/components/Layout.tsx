import { NavLink, Outlet } from 'react-router-dom';
import { Home, ListOrdered, History, User } from 'lucide-react';
import { cn } from './ui';
import { haptics } from '../lib/haptics';

export function MobileNav() {
  const links = [
    { to: '/',        icon: Home,        label: 'Home'    },
    { to: '/round',   icon: ListOrdered, label: 'Tally'   },
    { to: '/history', icon: History,     label: 'History' },
    { to: '/profile', icon: User,        label: 'Profile' },
  ];

  return (
    <nav className="mobile-nav-bar" aria-label="Main Navigation">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          aria-label={link.label}
          onClick={() => haptics.light()}
          className={({ isActive }) =>
            cn(
              'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 select-none',
              isActive
                ? 'bg-black/90 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-700 hover:bg-black/5'
            )
          }
        >
          {({ isActive }) => (
            <link.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  return (
    <div style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: '5.5rem' }}>
      <main className="max-w-md mx-auto px-4 py-6 animate-fade-in">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
