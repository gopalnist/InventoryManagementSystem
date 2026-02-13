import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Notifications } from '../ui/Notifications';
import { useAppStore } from '../../store/appStore';

interface LayoutProps {
  module?: 'ims' | 'ams';
}

export function Layout({ module = 'ims' }: LayoutProps) {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar module={module} />

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Header */}
        <Header module={module} />

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] pt-16">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Notifications */}
      <Notifications />
    </div>
  );
}

