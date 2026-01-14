import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Upload, Trash2, ArrowRight, Edit2, X, Check, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Tournament, SavedPlayer } from '../types/database.types';

export default function PlayerManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSavedPlayers, setSelectedSavedPlayers] = useState<Set<string>>(new Set());
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState(0);
  const [newPlayerFlight, setNewPlayerFlight] = useState('A');

  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState(0);
  const [editFlight, setEditFlight] = useState('A');

  useEffect(() => {
    loadData();
    loadSavedPlayers();
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

  const loadSavedPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_players')
        .select('*')
        .order('name');

      if (error) throw error;
      setSavedPlayers(data || []);
    } catch (error) {
      console.error('Error loading saved players:', error);
    }
  };

  const toggleSavedPlayer = (playerId: string) => {
    const newSelected = new Set(selectedSavedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedSavedPlayers(newSelected);
  };

  const importSelectedPlayers = async () => {
    if (selectedSavedPlayers.size === 0) {
      alert('Please select at least one player');
      return;
    }

    try {
      const playersToImport = savedPlayers
        .filter(p => selectedSavedPlayers.has(p.id))
        .map(p => ({
          tournament_id: id,
          name: p.name,
          handicap: p.handicap,
          flight: tournament?.flights[0] || 'A',
          paid: false,
          in_skins: false
        }));

      const { error } = await supabase
        .from('players')
        .insert(playersToImport);

      if (error) throw error;

      alert(`Imported ${playersToImport.length} players successfully!`);
      setShowImportModal(false);
      setSelectedSavedPlayers(new Set());
      loadData();
    } catch (error) {
      console.error('Error importing players:', error);
      alert('Failed to import players');
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('players')
        .insert([{
          tournament_id: id,
          name: newPlayerName,
          handicap: newPlayerHandicap,
          flight: newPlayerFlight,
          paid: false,
          in_skins: false
        }]);

      if (error) throw error;
      
      setNewPlayerName('');
      setNewPlayerHandicap(0);
      setNewPlayerFlight('A');
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to add player');
    }
  };

  const startEdit = (player: Player) => {
    setEditingPlayer(player.id);
    setEditName(player.name);
    setEditHandicap(player.handicap);
    setEditFlight(player.flight);
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditName('');
    setEditHandicap(0);
    setEditFlight('A');
  };

  const saveEdit = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({
          name: editName,
          handicap: editHandicap,
          flight: editFlight
        })
        .eq('id', playerId);

      if (error) throw error;
      setEditingPlayer(null);
      loadData();
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Failed to update player');
    }
  };

  const deletePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Delete ${playerName}?`)) return;

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to delete player');
    }
  };

  const togglePaid = async (playerId: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ paid: !currentPaid })
        .eq('id', playerId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating paid status:', error);
      alert('Failed to update paid status');
    }
  };

  const toggleSkins = async (playerId: string, currentSkins: boolean) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ in_skins: !currentSkins })
        .eq('id', playerId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating skins status:', error);
      alert('Failed to update skins status');
    }
  };

  const handleBulkImport = async () => {
    const csvText = prompt(
      'Paste CSV data (Name, Handicap):\nExample:\nJohn Smith, 12\nJane Doe, 8'
    );
    
    if (!csvText) return;

    const lines = csvText.trim().split('\n');
    const playersToAdd = lines.map(line => {
      const [name, handicap] = line.split(',').map(s => s.trim());
      return {
        tournament_id: id,
        name,
        handicap: parseInt(handicap) || 0,
        flight: 'A',
        paid: false,
        in_skins: false
      };
    });

    try {
      const { error } = await supabase
        .from('players')
        .insert(playersToAdd);

      if (error) throw error;
      
      alert(`Added ${playersToAdd.length} players`);
      loadData();
    } catch (error: any) {
      console.error('Error importing players:', error);
      alert('Failed to import players');
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

  const existingPlayerNames = new Set(players.map(p => p.name.toLowerCase()));
  const availableSavedPlayers = savedPlayers.filter(
    sp => !existingPlayerNames.has(sp.name.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{tournament.name}</h2>
          <p className="text-gray-600 mt-1">Player Management - {players.length} players</p>
        </div>
        <div className="flex gap-2">
          {availableSavedPlayers.length > 0 && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Import Saved
            </button>
          )}
          <button
            onClick={handleBulkImport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Import Saved Players</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select players to add to this tournament
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {availableSavedPlayers.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  All saved players are already in this tournament
                </p>
              ) : (
                <div className="space-y-2">
                  {availableSavedPlayers.map(player => (
                    <label
                      key={player.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSavedPlayers.has(player.id)}
                        onChange={() => toggleSavedPlayer(player.id)}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-gray-600">
                          Handicap: {player.handicap} | Quota: {36 - player.handicap}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedSavedPlayers(new Set());
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={importSelectedPlayers}
                disabled={selectedSavedPlayers.size === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {selectedSavedPlayers.size} Player{selectedSavedPlayers.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Player</h3>
          <form onSubmit={addPlayer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player Name *
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handicap
                </label>
                <input
                  type="number"
                  value={newPlayerHandicap}
                  onChange={(e) => setNewPlayerHandicap(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flight
                </label>
                <select
                  value={newPlayerFlight}
                  onChange={(e) => setNewPlayerFlight(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {tournament.flights.map(flight => (
                    <option key={flight} value={flight}>Flight {flight}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Add Player
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {players.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">No players added yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Player
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {tournament.flights.map(flight => {
            const flightPlayers = playersByFlight[flight] || [];
            if (flightPlayers.length === 0) return null;

            const quotaRange = flightPlayers.length > 0
              ? `${Math.min(...flightPlayers.map(p => p.quota))} - ${Math.max(...flightPlayers.map(p => p.quota))}`
              : '-';

            return (
              <div key={flight} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-green-600 text-white px-6 py-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Flight {flight}</h3>
                    <div className="text-sm">
                      {flightPlayers.length} players | Quota Range: {quotaRange}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Handicap</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quota</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Flight</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid</th>
                        {tournament.skins_enabled && (
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">In Skins</th>
                        )}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {flightPlayers.map(player => {
                        const isEditing = editingPlayer === player.id;

                        return (
                          <tr key={player.id} className="hover:bg-gray-50">
                            {isEditing ? (
                              <>
                                <td className="px-6 py-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                <td className="px-6 py-4"><input type="number" value={editHandicap} onChange={(e) => setEditHandicap(parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-center" /></td>
                                <td className="px-6 py-4 text-center font-semibold">{36 - editHandicap}</td>
                                <td className="px-6 py-4">
                                  <select value={editFlight} onChange={(e) => setEditFlight(e.target.value)} className="px-2 py-1 border rounded">
                                    {tournament.flights.map(f => <option key={f} value={f}>Flight {f}</option>)}
                                  </select>
                                </td>
                                <td className="px-6 py-4 text-center">-</td>
                                {tournament.skins_enabled && <td className="px-6 py-4 text-center">-</td>}
                                <td className="px-6 py-4">
                                  <div className="flex justify-center gap-2">
                                    <button onClick={() => saveEdit(player.id)} className="p-2 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                    <button onClick={cancelEdit} className="p-2 text-gray-600 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap font-medium">{player.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">{player.handicap}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center font-semibold">{player.quota}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">{player.flight}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <button onClick={() => togglePaid(player.id, player.paid)} className={`px-3 py-1 rounded text-sm font-medium ${player.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {player.paid ? 'Paid' : 'Unpaid'}
                                  </button>
                                </td>
                                {tournament.skins_enabled && (
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <button onClick={() => toggleSkins(player.id, player.in_skins || false)} className={`px-3 py-1 rounded text-sm font-medium ${player.in_skins ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                      {player.in_skins ? 'In' : 'Out'}
                                    </button>
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <div className="flex justify-center gap-2">
                                    <button onClick={() => startEdit(player)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => deletePlayer(player.id, player.name)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {players.length > 0 && (
        <div className="mt-8 flex justify-end gap-2">
          <Link
            to={`/admin/tournament/${id}/flights`}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Manage Flights
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button
            onClick={() => navigate(`/admin/tournament/${id}/groups`)}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            Next: Create Groups
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}