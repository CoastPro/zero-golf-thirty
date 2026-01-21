import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PhoneLogin() {
  const [last4, setLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find player by last 4 digits of phone
      const { data: players, error: playerError } = await supabase
        .from('players')
        .select('*, tournaments!inner(id, name, hidden)')
        .like('phone', `%${last4}`)
        .eq('tournaments.hidden', false);

      if (playerError) throw playerError;

      if (!players || players.length === 0) {
        setError('No player found with that phone number');
        setLoading(false);
        return;
      }

      // Find which group they're in
      const playerId = players[0].id;
      const tournamentId = players[0].tournaments.id;

      const { data: groupAssignment, error: groupError } = await supabase
        .from('group_players')
        .select('group_id')
        .eq('player_id', playerId)
        .single();

      if (groupError || !groupAssignment) {
        setError("You're not assigned to a group yet. Contact the tournament director.");
        setLoading(false);
        return;
      }

      // Redirect to scoring locked to their group
      navigate(`/tournament/${tournamentId}/score?group=${groupAssignment.group_id}`);

    } catch (err: any) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Player Scoring</h2>
            <p className="text-gray-600">Enter the last 4 digits of your phone number</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={last4}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 4) setLast4(value);
                }}
                placeholder="1234"
                maxLength={4}
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-3xl tracking-widest"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={last4.length !== 4 || loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Loading...'
              ) : (
                <>
                  <LogIn className="w-6 h-6" />
                  Continue
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full text-gray-600 hover:text-gray-900 text-sm transition-colors"
            >
              ← Back to Home
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}