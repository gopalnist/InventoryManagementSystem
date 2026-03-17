import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  /** If false, clicking the backdrop will not close the drawer. Default true. */
  closeOnBackdropClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full',
};

export function Drawer({ isOpen, onClose, title, subtitle, children, size = 'lg', footer, closeOnBackdropClick = true }: DrawerProps) {
  const { currentTheme } = useThemeStore();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeOnBackdropClick ? onClose : undefined}
        role="presentation"
      />
      
      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <div 
          className={`w-screen ${sizeClasses[size]} transform transition-transform duration-300 ease-out animate-slide-in-right`}
        >
          <div className="flex h-full flex-col bg-white shadow-2xl">
            {/* Header */}
            <div className={`flex items-center justify-between border-b border-slate-200 bg-gradient-to-r ${currentTheme.sidebar.bg} px-6 py-4`}>
              <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-white/70">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

