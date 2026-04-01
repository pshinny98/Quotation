import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FileText, Users, Package, LogOut, Plus } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { path: '/', label: 'New Quotation', icon: Plus },
    { path: '/quotations', label: 'Quotations', icon: FileText },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/products', label: 'Products', icon: Package },
  ];

  return (
    <div className="min-h-screen flex bg-surface text-on-surface font-body">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col shadow-[4px_0_24px_rgba(0,42,88,0.02)] print:hidden">
        <div className="p-6 border-b border-outline-variant/30">
          <h1 className="text-2xl font-headline font-bold text-primary tracking-tight">Janus</h1>
          <p className="text-xs font-label text-on-surface-variant uppercase tracking-widest mt-1">Furniture</p>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/quotations' && location.pathname.startsWith('/quotations/'));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive 
                    ? 'bg-primary/10 text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-primary' : 'text-on-surface-variant'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/30">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium text-error hover:bg-error-container hover:text-on-error-container transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        {children}
      </main>
    </div>
  );
}
