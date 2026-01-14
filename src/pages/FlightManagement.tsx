import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Shuffle, Save, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Tournament } from '../types/database.types';

export default function FlightManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'quota' | 'handicap'>('quota');

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
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const autoAssignFlights = () => {
    if (players.length === 0 || !tournament) return;

    const sortedPlayers = [...players].sort((a, b) => {
      if (sortBy === 'quota') {
        return b.quota - a.quota; // Higher quota first
      } else {
        return a.handicap - b.handicap; // Lower handicap first
      }
    });

    const numFlights = tournament.flights.length;
    const playersPerFlight = Math.ceil(sortedPlayers.length / numFlights);

    const updatedPlayers = sortedPlayers.map((player, index) => {
      const flightIndex = Math.floor(index / playersPerFlight);
      const flight = tournament.flights[Math.min(flightIndex, numFlights - 1)];
      return { ...player, flight };
    });

    setPlayers(updatedPlayers);
  };

  const updatePlayerFlight = (playerId: string, newFlight: string) => {
    setPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, flight: newFlight } : p))
    );
  };

  const saveFlights = async () => {
    setSaving(true);
    try {
      for (const player of players) {
        const { error } = await supabase
          .from('players')
          .update({ flight: player.flight })
          .eq('id', player.id);

        if (error) throw error;
      }

      alert('Flight assignments saved successfully!');
      loadData();
    } catch (error) {
      console.error('Error saving flights:', error);
      alert('Failed to save flight assignments');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!tournament) {
    return <div className="text-center py-12">Tournament not found</div>;
  }

  const playersByFlight = tournament.flights.reduce((acc, flight) => {
    acc[flight] = players.filter(p => p.flight === flight);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{tournament.name}</h2>
          <p className="text-gray-600 mt-1">Flight Management - {players.length} players</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/admin/tournament/${id}/players`}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Players
          </Link>
          <button
            onClick={saveFlights}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Flights'}
          </button>
        </div>
      </div>

      {/* Auto-Assign Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Auto-Assign Flights</h3>
        <p className="text-sm text-gray-600 mb-4">
          Automatically distribute players into {tournament.flights.length} flights based on skill level
        </p>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="quota"
                checked={sortBy === 'quota'}
                onChange={(e) => setSortBy(e.target.value as 'quota' | 'handicap')}
                className="w-4 h-4 text-green-600"
              />
              <span>Sort by Quota (Stableford)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="handicap"
                checked={sortBy === 'handicap'}
                onChange={(e) => setSortBy(e.target.value as 'quota' | 'handicap')}
                className="w-4 h-4 text-green-600"
              />
              <span>Sort by Handicap</span>
            </label>
          </div>
          
          <button
            onClick={autoAssignFlights}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Shuffle className="w-5 h-5" />
            Auto-Assign
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Tip: Configure the number of flights in Tournament Setup. Players will be evenly distributed.
        </p>
      </div>

      {/* Flight Display */}
      <div className="space-y-6">
        {tournament.flights.map(flight => {
          const flightPlayers = playersByFlight[flight] || [];
          const avgQuota = flightPlayers.length > 0
            ? (flightPlayers.reduce((sum, p) => sum + p.quota, 0) / flightPlayers.length).toFixed(1)
            : '0';
          const avgHandicap = flightPlayers.length > 0
            ? (flightPlayers.reduce((sum, p) => sum + p.handicap, 0) / flightPlayers.length).toFixed(1)
            : '0';

          return (
            <div key={flight} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-green-600 text-white px-6 py-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Flight {flight}</h3>
                  <div className="text-sm">
                    {flightPlayers.length} players | Avg Quota: {avgQuota} | Avg Handicap: {avgHandicap}
                  </div>
                </div>
              </div>
              
              {flightPlayers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No players assigned to this flight
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Handicap</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quota</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assign to Flight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {flightPlayers
                        .sort((a, b) => sortBy === 'quota' ? b.quota - a.quota : a.handicap - b.handicap)
                        .map(player => (
                          <tr key={player.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium">{player.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">{player.handicap}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center font-semibold">{player.quota}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <select
                                value={player.flight}
                                onChange={(e) => updatePlayerFlight(player.id, e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                              >
                                {tournament.flights.map(f => (
                                  <option key={f} value={f}>Flight {f}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          to={`/admin/tournament/${id}/edit`}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Need to add/remove flights? Edit Tournament Settings
        </Link>
        
        <div className="flex gap-2">
          <button
            onClick={saveFlights}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
          <Link
            to={`/admin/tournament/${id}/groups`}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg font-semibold transition-colors"
          >
            Next: Create Groups
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}