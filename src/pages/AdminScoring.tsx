import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Save, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Score, Tournament } from '../types/database.types';

export default function AdminScoring() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Record<string, Record<number, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', id)
        .order('name');

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      if (playersData && playersData.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('*')
          .in('player_id', playersData.map(p => p.id));

        if (scoresError) throw scoresError;

        const scoresMap: Record<string, Record<number, number | null>> = {};
        playersData.forEach(player => {
          scoresMap[player.id] = {};
          for (let hole = 1; hole <= 18; hole++) {
            const score = scoresData?.find(s => s.player_id === player.id && s.hole === hole);
            scoresMap[player.id][hole] = score?.score || null;
          }
        });

        setScores(scoresMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateScore = (playerId: string, hole: number, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    if (numValue !== null && (numValue < 1 || numValue > 10)) return;

    setScores(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [hole]: numValue
      }
    }));
  };

  const saveAllScores = async () => {
    setSaving(true);
    try {
      const scoresToUpsert: any[] = [];

      Object.keys(scores).forEach(playerId => {
        for (let hole = 1; hole <= 18; hole++) {
          const score = scores[playerId]?.[hole];
          if (score !== null && score !== undefined) {
            scoresToUpsert.push({
              player_id: playerId,
              hole,
              score
            });
          }
        }
      });

      if (scoresToUpsert.length > 0) {
        const { error } = await supabase
          .from('scores')
          .upsert(scoresToUpsert, {
            onConflict: 'player_id,hole'
          });

        if (error) throw error;
        alert('All scores saved successfully!');
      }
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = (playerId: string): number => {
    let total = 0;
    for (let hole = 1; hole <= 18; hole++) {
      total += scores[playerId]?.[hole] || 0;
    }
    return total;
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!tournament) {
    return <div className="text-center py-12">Tournament not found</div>;
  }

  const frontNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const backNine = [10, 11, 12, 13, 14, 15, 16, 17, 18];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{tournament.name}</h2>
          <p className="text-gray-600 mt-1">Admin Scoring - Grid View</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveAllScores}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save All Scores'}
          </button>
          <Link
            to={`/tournament/${id}/leaderboard`}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg font-semibold transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Front 9 */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="bg-green-600 text-white px-4 py-3">
          <h3 className="text-lg font-semibold">Front 9</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-semibold border-r">Player</th>
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-semibold border-r" style={{left: '200px'}}>Flight</th>
                {frontNine.map(hole => (
                  <th key={hole} className="px-2 py-2 text-center font-semibold border-l">
                    <div className="text-xs text-gray-600">Hole {hole}</div>
                    <div className="text-sm">Par {tournament.course_par[hole - 1]}</div>
                  </th>
                ))}
                <th className="px-4 py-2 text-center font-semibold border-l bg-gray-100">Out</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {players.map(player => {
                const frontTotal = frontNine.reduce((sum, hole) => sum + (scores[player.id]?.[hole] || 0), 0);
                return (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-4 py-2 font-medium border-r whitespace-nowrap">{player.name}</td>
                    <td className="sticky left-0 bg-white px-4 py-2 text-center border-r" style={{left: '200px'}}>{player.flight}</td>
                    {frontNine.map(hole => (
                      <td key={hole} className="px-2 py-2 border-l">
                        <input
                          type="number"
                          value={scores[player.id]?.[hole] || ''}
                          onChange={(e) => updateScore(player.id, hole, e.target.value)}
                          min="1"
                          max="10"
                          className="w-12 px-1 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          placeholder="-"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-bold border-l bg-gray-50">{frontTotal || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Back 9 */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="bg-green-600 text-white px-4 py-3">
          <h3 className="text-lg font-semibold">Back 9</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-semibold border-r">Player</th>
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-semibold border-r" style={{left: '200px'}}>Flight</th>
                {backNine.map(hole => (
                  <th key={hole} className="px-2 py-2 text-center font-semibold border-l">
                    <div className="text-xs text-gray-600">Hole {hole}</div>
                    <div className="text-sm">Par {tournament.course_par[hole - 1]}</div>
                  </th>
                ))}
                <th className="px-4 py-2 text-center font-semibold border-l bg-gray-100">In</th>
                <th className="px-4 py-2 text-center font-semibold border-l bg-green-100">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {players.map(player => {
                const backTotal = backNine.reduce((sum, hole) => sum + (scores[player.id]?.[hole] || 0), 0);
                const total = calculateTotal(player.id);
                return (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-4 py-2 font-medium border-r whitespace-nowrap">{player.name}</td>
                    <td className="sticky left-0 bg-white px-4 py-2 text-center border-r" style={{left: '200px'}}>{player.flight}</td>
                    {backNine.map(hole => (
                      <td key={hole} className="px-2 py-2 border-l">
                        <input
                          type="number"
                          value={scores[player.id]?.[hole] || ''}
                          onChange={(e) => updateScore(player.id, hole, e.target.value)}
                          min="1"
                          max="10"
                          className="w-12 px-1 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          placeholder="-"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-bold border-l bg-gray-50">{backTotal || '-'}</td>
                    <td className="px-4 py-2 text-center font-bold border-l bg-green-50 text-green-700">{total || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={saveAllScores}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 shadow-lg"
        >
          <Save className="w-6 h-6" />
          {saving ? 'Saving All Scores...' : 'Save All Scores'}
        </button>
      </div>
    </div>
  );
}