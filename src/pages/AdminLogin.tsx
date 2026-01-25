import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [adminPin, setAdminPin] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (playerPhone.length !== 4) {
        setError('Please enter the last 4 digits of your phone number');
        setLoading(false);
        return;
      }

      // Find player by last 4 digits of phone
      const { data: players, error: playerError } = await supabase
        .from('players')
        .select('*, group_players!inner(group_id)')
        .like('phone', `%${playerPhone}`);

      if (playerError) throw playerError;

      if (!players || players.length === 0) {
        setError('Phone number not found. Please check with your tournament organizer.');
        setLoading(false);
        return;
      }

      const player = players[0];
      const groupId = player.group_players?.[0]?.group_id;

      if (!groupId) {
        setError('You have not been assigned to a group yet.');
        setLoading(false);
        return;
      }

      // Navigate to scoring with group restriction
      navigate(`/tournament/${player.tournament_id}/score?group=${groupId}`);
    } catch (error) {
      console.error('Player login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Zero Golf Thirty
            </h1>
            <p className="text-gray-600">
              Select your login type below
            </p>
          </div>

          {/* Player Login Section - NOW ON TOP */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
              Player Login
            </h2>
            <form onSubmit={handlePlayerLogin} className="space-y-4">
              <div>
                <label htmlFor="playerPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  Last 4 Digits of Phone
                </label>
                <input
                  id="playerPhone"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading || playerPhone.length !== 4}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Player Login'}
              </button>
            </form>
          </div>

          {/* Admin Login Section - NOW ON BOTTOM */}
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