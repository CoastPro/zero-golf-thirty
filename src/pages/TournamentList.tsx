import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Users, BarChart3, Edit, Trash2, Trophy, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      alert('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const deleteTournament = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadTournaments();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading tournaments...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Tournaments</h2>
        <Link
          to="/admin/tournament/new"
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          New Tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first tournament</p>
          <Link
            to="/admin/tournament/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
                  <div className="flex gap-2">
                    <Link
                      to={`/admin/tournament/${tournament.id}/edit`}
                      className="p-2 text-gray-600 hover:text-green-600 transition-colors rounded-lg hover:bg-green-50"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => deleteTournament(tournament.id, tournament.name)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {tournament.course_name && (
                  <p className="text-gray-600 mb-2">{tournament.course_name}</p>
                )}
                
                {tournament.tournament_date && (
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(tournament.tournament_date).toLocaleDateString()}</span>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 mt-6">
                  <Link
                    to={`/admin/tournament/${tournament.id}/players`}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-colors"
                  >
                    <Users className="w-6 h-6 text-green-600" />
                    <span className="text-sm font-medium">Players</span>
                  </Link>
                  
                  <Link
                    to={`/admin/tournament/${tournament.id}/groups`}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-colors"
                  >
                    <Users className="w-6 h-6 text-green-600" />
                    <span className="text-sm font-medium">Groups</span>
                  </Link>

                  <Link
                    to={`/admin/tournament/${tournament.id}/admin-score`}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-colors"
                  >
                    <Pencil className="w-6 h-6 text-green-600" />
                    <span className="text-sm font-medium">Score</span>
                  </Link>
                  
                  <Link
                    to={`/tournament/${tournament.id}/leaderboard`}
                    className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-colors"
                  >
                    <BarChart3 className="w-6 h-6 text-green-600" />
                    <span className="text-sm font-medium">Results</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}