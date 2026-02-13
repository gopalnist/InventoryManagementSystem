import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'outline' | 'destructive' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }, ref) => {
    const { currentTheme } = useThemeStore();

    const variants = {
      primary: `${currentTheme.accent} ${currentTheme.accentHover} text-white shadow-sm hover:shadow-md`,
      default: `${currentTheme.accent} ${currentTheme.accentHover} text-white shadow-sm hover:shadow-md`,
      secondary: 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm',
      outline: 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
      destructive: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
      success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
      warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
      ghost: 'hover:bg-slate-100 text-slate-600',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200
          disabled:cursor-not-allowed disabled:opacity-60
          active:scale-[0.98]
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
