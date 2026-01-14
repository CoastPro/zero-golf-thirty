import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft, LogOut, Database } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const isHome = location.pathname === '/admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-green-800 to-green-700 text-white shadow-xl border-b-4 border-green-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <Trophy className="w-10 h-10 text-yellow-300" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Zero Golf Thirty</h1>
                <p className="text-green-100 text-sm">Admin Dashboard</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 mr-4">
                <Link
                  to="/admin/saved-courses"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === '/admin/saved-courses'
                      ? 'bg-green-600 text-white'
                      : 'text-green-100 hover:bg-green-600'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span className="text-sm font-medium">Courses</span>
                </Link>
                <Link
                  to="/admin/saved-players"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === '/admin/saved-players'
                      ? 'bg-green-600 text-white'
                      : 'text-green-100 hover:bg-green-600'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span className="text-sm font-medium">Players</span>
                </Link>
              </div>
              
              {!isHome && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-500 rounded-xl transition-all transform hover:scale-105 font-semibold shadow-lg text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Home</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all transform hover:scale-105 font-semibold shadow-lg text-white"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}