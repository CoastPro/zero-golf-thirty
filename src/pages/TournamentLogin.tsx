import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';

export default function TournamentLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerPhone, setPlayerPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTournament();
  }, [slug]);

  const loadTournament = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      setTournament(data);
    } catch (error) {
      console.error('Error loading tournament:', error);
    }
  };

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

      const { data: players, error: playerError } = await supabase
        .from('players')
        .select('*, group_players!inner(group_id)')
        .eq('tournament_id', tournament?.id)
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

      navigate(`/tournament/${tournament?.id}/score?group=${groupId}`);
    } catch (error) {
      console.error('Player login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!tournament) {
    return <div className="text-center py-12">Loading tournament...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Tournament Logo */}
          {tournament.tournament_logo_url && (
            <div className="flex justify-center mb-6">
              <img 
                src={tournament.tournament_logo_url} 
                alt="Tournament Logo" 
                className="h-24 object-contain"
              />
            </div>
          )}

          {/* Tournament Name */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {tournament.name}
          </h1>
          {tournament.course_name && (
            <p className="text-center text-gray-600 mb-6">
              {tournament.course_name}
            </p>
          )}

          {/* Sponsor Logo */}
          {tournament.tournament_sponsor_logo_url && (
            <div className="flex justify-center mb-6">
              <img 
                src={tournament.tournament_sponsor_logo_url} 
                alt="Sponsor Logo" 
                className="h-16 object-contain"
              />
            </div>
          )}

          {/* Player Login */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-center text-gray-900 mb-4">
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
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-wider focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading || playerPhone.length !== 4}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Login to Score'}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
          </div>

          {/* Scoring/Leaderboard Button */}
          <div className="mb-6">
            <button
              onClick={() => navigate(`/tournament/${tournament.id}/leaderboard`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              View Leaderboard
            </button>
          </div>

          {/* Custom Buttons */}
          {tournament.custom_buttons && tournament.custom_buttons.length > 0 && (
            <div className="space-y-2">
              {tournament.custom_buttons.map((button, index) => (
                <a
                  key={index}
                  href={button.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 rounded-lg transition-colors"
                >
                  {button.label}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}