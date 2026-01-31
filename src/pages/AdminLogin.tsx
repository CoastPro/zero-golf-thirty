import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Look up user by PIN
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('pin', adminPin);

      if (userError) throw userError;

      if (!users || users.length === 0) {
        setError('Invalid PIN');
        setLoading(false);
        return;
      }

      const user = users[0];

      // Log them in
      login(user);

      // Navigate to admin dashboard
      navigate('/admin');
    } catch (error) {
      console.error('Admin login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src="/zero-golf-thirty-logo.png" 
              alt="Zero Golf Thirty" 
              className="h-32 object-contain"
            />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Zero Golf Thirty
            </h1>
          </div>

          {/* Admin Login Section */}
          <div>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
              Admin Login
            </h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label htmlFor="adminPin" className="block text-sm font-medium text-gray-700 mb-2">
                  6-Digit PIN
                </label>
                <input
                  id="adminPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-wider focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || adminPin.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Admin Login'}
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}