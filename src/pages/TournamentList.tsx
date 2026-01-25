import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, LogOut, UserCog } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';
import { useAuth } from '../context/AuthContext';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
      return;
    }
    loadTournaments();
  }, [user, navigate]);

  const loadTournaments = async () => {
    try {
      let query = supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      // If sub-admin, only show their tournaments
      if (user?.role === 'sub_admin') {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      alert('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome, {user.name} {user.role === 'master_admin' && '(Master Admin)'}
              </p>
            </div>
            <div className="flex gap-3">
              {user.role === 'master_admin' && (
                <Link
                  to="/admin/users"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <UserCog className="w-5 h-5" />
                  Manage Users
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Tournaments</h2>
          <Link
            to="/admin/tournament/new"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading tournaments...</div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
            <p className="text-gray-600 mb-6">Create your first tournament to get started</p>
            <Link
              to="/admin/tournament/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(tournament => (
              <Link
                key={tournament.id}
                to={`/admin/tournament/${tournament.id}/players`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 border-transparent hover:border-green-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {tournament.name}
                    </h3>
                    {tournament.course_name && (
                      <p className="text-sm text-gray-600">{tournament.course_name}</p>
                    )}
                  </div>
                  <Calendar className="w-6 h-6 text-green-600 flex-shrink-0" />
                </div>

                <div className="space-y-2">
                  {tournament.tournament_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(tournament.tournament_date).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    {tournament.flights.length} Flight{tournament.flights.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex gap-2">
                    <Link
                      to={`/admin/tournament/${tournament.id}/edit`}
                      className="flex-1 text-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                    <Link
                      to={`/tournament/${tournament.id}/leaderboard`}
                      className="flex-1 text-center px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium text-sm transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}