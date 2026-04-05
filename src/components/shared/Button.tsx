'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-11';

        const variants = {
            primary:
                'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700 focus:ring-primary-500 shadow-[var(--brand-shadow-xs)] hover:shadow-[var(--brand-shadow-sm)]',
            secondary:
                'bg-secondary-500 text-white hover:bg-secondary-600 dark:bg-secondary-600 dark:hover:bg-secondary-700 focus:ring-secondary-500 shadow-[var(--brand-shadow-xs)] hover:shadow-[var(--brand-shadow-sm)]',
            danger:
                'bg-danger-600 text-white hover:bg-danger-700 dark:bg-danger-600 dark:hover:bg-danger-700 focus:ring-danger-500 shadow-sm hover:shadow',
            ghost:
                'text-primary-900/85 dark:text-primary-100/90 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 focus:ring-primary-400/50',
            outline:
                'border-2 border-primary-200/90 dark:border-primary-700/55 text-primary-900 dark:text-primary-50 hover:border-secondary-400 dark:hover:border-secondary-500 hover:bg-secondary-50/50 dark:hover:bg-primary-900/25 focus:ring-primary-400/40',
        };

        const sizes = {
            sm: 'text-sm px-3 py-2',
            md: 'text-base px-4 py-2.5',
            lg: 'text-lg px-6 py-3',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : leftIcon ? (
                    leftIcon
                ) : null}
                {children}
                {rightIcon && !isLoading && rightIcon}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
