import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, BarChart3, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';

export default function PublicTournamentList() {
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
        .order('tournament_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-green-800 to-green-700 text-white shadow-xl border-b-4 border-green-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-300" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Zero Golf Thirty</h1>
              <p className="text-green-100 text-sm">Public Leaderboards</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Active Tournaments</h2>

        {tournaments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments available</h3>
            <p className="text-gray-600">Check back soon for upcoming tournaments</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                to={`/tournament/${tournament.id}/leaderboard`}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 text-white">
                  <h3 className="text-2xl font-bold mb-2">{tournament.name}</h3>
                  {tournament.course_name && (
                    <p className="text-green-100">{tournament.course_name}</p>
                  )}
                </div>
                
                <div className="p-6">
                  {tournament.tournament_date && (
                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                      <Calendar className="w-5 h-5" />
                      <span>{new Date(tournament.tournament_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <span className="text-gray-600 font-medium">View Leaderboard</span>
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}