'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  variant?: 'solid' | 'outline' | 'subtle';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  color,
  variant = 'subtle',
  size = 'sm',
  className,
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = () => {
    if (color) {
      switch (variant) {
        case 'solid':
          return { backgroundColor: color, color: 'white' };
        case 'outline':
          return {
            border: `1px solid ${color}`,
            color,
            backgroundColor: 'transparent',
          };
        case 'subtle':
          return {
            backgroundColor: `${color}15`,
            color,
            border: `1px solid ${color}20`,
          };
      }
    }
    return {};
  };

  const defaultVariant = !color
    ? {
        solid: 'bg-accent-primary text-white',
        outline: 'border border-border-default text-text-secondary',
        subtle: 'bg-elevated text-text-secondary border border-border-subtle',
      }[variant]
    : '';

  return (
    <span
      className={clsx(baseClasses, sizeClasses[size], defaultVariant, className)}
      style={variantStyles()}
    >
      {children}
    </span>
  );
}
