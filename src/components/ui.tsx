import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ─── Card Components ────────────────────────── */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'hero' | 'highlight' | 'profile';
  padding?: 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children, className, variant = 'default', padding = 'md', ...props
}: CardProps) {
  const padMap = { sm: 'p-3.5', md: 'p-4.5', lg: 'p-6' };

  if (variant === 'hero') {
    return (
      <div className={cn('radiant-hero-card', className)} {...props}>
        <div className="radiant-hero-content">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'clean-card',
        padMap[padding],
        variant === 'highlight' && 'border-slate-300 ring-1 ring-black/5',
        variant === 'profile' && 'shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Section Label ──────────────────────────── */
export function SectionLabel({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <p className={cn('section-label mb-1.5', className)} style={style}>{children}</p>;
}

/* ─── Apple Style Minimal Badge ──────────────── */
export function LimeBadge({ children, className, style, variant = 'default' }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; variant?: 'default' | 'tint' }) {
  return (
    <span
      className={cn('apple-badge', variant === 'tint' && 'apple-badge-tint', className)}
      style={style}
    >
      {children}
    </span>
  );
}

/* ─── Apple Style Button ─────────────────────── */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'lime' | 'secondary' | 'danger';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children, className, variant = 'primary', isLoading, disabled, size = 'md', ...props
}: ButtonProps) {
  const sizeMap = {
    sm: 'min-h-[34px] px-3 text-xs',
    md: 'min-h-[44px] px-5 text-sm',
    lg: 'min-h-[50px] px-7 text-base',
  };

  const variantClass = {
    primary: 'bg-[#000000] text-white hover:bg-[#1d1d1f] shadow-sm active:scale-[0.98]',
    lime: 'bg-[#1d1d1f] text-white hover:bg-[#000000] active:scale-[0.98]',
    secondary: 'bg-white/70 backdrop-blur-md text-[#1d1d1f] border border-black/8 hover:bg-white active:scale-[0.98]',
    danger: 'bg-red-50 text-red-600 border border-red-200/60 hover:bg-red-100',
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        'rounded-full font-medium transition-all duration-200 inline-flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass,
        sizeMap[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg
            className="animate-spin"
            style={{ width: 16, height: 16 }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none" viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </span>
      ) : children}
    </button>
  );
}

/* ─── Minimal Apple Style Avatar ─────────────── */
interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar({ name, avatarUrl, size = 44, className, style }: AvatarProps) {
  const letter = name?.charAt(0).toUpperCase() ?? '?';

  if (avatarUrl) {
    return (
      <div
        className={cn('minimal-avatar select-none shrink-0 overflow-hidden', className)}
        style={{
          width: size,
          height: size,
          background: 'rgba(255, 255, 255, 0.85)',
          ...style,
        }}
        title={name}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover select-none pointer-events-none"
          loading="lazy"
        />
      </div>
    );
  }

  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const tintIndex = Math.abs(hash) % 5;
  const tintClass = `avatar-tint-${tintIndex}`;

  return (
    <div
      className={cn('minimal-avatar select-none shrink-0', tintClass, className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        ...style,
      }}
      title={name}
    >
      <span>{letter}</span>
    </div>
  );
}

/* ─── Loading Skeleton ───────────────────────── */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('rounded-xl animate-pulse bg-black/5', className)}
      style={style}
    />
  );
}

/* ─── Toast / Alert strip ────────────────────── */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(254, 242, 242, 0.8)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(254, 202, 202, 0.6)',
      borderRadius: '0.85rem',
      padding: '0.75rem 1rem',
      color: '#b91c1c',
      fontSize: '0.84rem',
      fontWeight: 500,
    }}>
      {message}
    </div>
  );
}
