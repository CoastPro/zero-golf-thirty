
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Check, Upload, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SavedPlayer, Tournament } from '../types/database.types';

export default function SavedPlayers() {
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [tournaments, setTournaments] = useState<{id: string; name: string; tournament_date: string | null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [tournamentPlayers, setTournamentPlayers] = useState<any[]>([]);
  const [loadingTournamentPlayers, setLoadingTournamentPlayers] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState(0);
  const [newPlayerPhone, setNewPlayerPhone] = useState('');

  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState(0);
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    loadPlayers();
    loadTournaments();
  }, []);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_players')
        .select('*')
        .order('name');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      alert('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const loadTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, tournament_date')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const loadTournamentPlayers = async (tournamentId: string) => {
    setLoadingTournamentPlayers(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, handicap, quota, phone')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (error) throw error;
      setTournamentPlayers(data || []);
    } catch (error) {
      console.error('Error loading tournament players:', error);
    } finally {
      setLoadingTournamentPlayers(false);
    }
  };

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournament(tournamentId);
    if (tournamentId) {
      loadTournamentPlayers(tournamentId);
    } else {
      setTournamentPlayers([]);
    }
  };

  const copyPlayersToDatabase = async () => {
    if (!tournamentPlayers.length) return;

    try {
      let updated = 0;
      let added = 0;

      for (const player of tournamentPlayers) {
        // Check if player already exists by name
        const existing = players.find(
          p => p.name.toLowerCase() === player.name.toLowerCase()
        );

        if (existing) {
          // Update existing player
          const { error } = await supabase
            .from('saved_players')
            .update({
              handicap: player.handicap,
              quota: player.quota || (36 - player.handicap),
              phone: player.phone || existing.phone
            })
            .eq('id', existing.id);

          if (error) throw error;
          updated++;
        } else {
          // Add new player
          const { error } = await supabase
            .from('saved_players')
            .insert({
              name: player.name,
              handicap: player.handicap,
              quota: player.quota || (36 - player.handicap),
              phone: player.phone || null
            });

          if (error) throw error;
          added++;
        }
      }

      alert(`Done! Added: ${added} new players, Updated: ${updated} existing players`);
      setShowCopyModal(false);
      setSelectedTournament('');
      setTournamentPlayers([]);
      loadPlayers();
    } catch (error) {
      console.error('Error copying players:', error);
      alert('Failed to copy players');
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('saved_players')
        .insert([{
          name: newPlayerName,
          handicap: newPlayerHandicap,
          quota: 36 - newPlayerHandicap,
          phone: newPlayerPhone || null
        }]);

      if (error) throw error;

      setNewPlayerName('');
      setNewPlayerHandicap(0);
      setNewPlayerPhone('');
      setShowAddForm(false);
      loadPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      alert('Failed to add player');
    }
  };

  const startEdit = (player: SavedPlayer) => {
    setEditingPlayer(player.id);
    setEditName(player.name);
    setEditHandicap(player.handicap);
    setEditPhone(player.phone || '');
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditName('');
    setEditHandicap(0);
    setEditPhone('');
  };

  const saveEdit = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('saved_players')
        .update({
          name: editName,
          handicap: editHandicap,
          quota: 36 - editHandicap,
          phone: editPhone || null
        })
        .eq('id', playerId);

      if (error) throw error;
      setEditingPlayer(null);
      loadPlayers();
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Failed to update player');
    }
  };

  const deletePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Delete ${playerName}?`)) return;

    try {
      const { error } = await supabase
        .from('saved_players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      loadPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to delete player');
    }
  };

  const handleBulkImport = async () => {
    const csvText = prompt(
      'Paste CSV data (Name, Handicap, Phone):\nExample:\nJohn Smith, 12, 5551234567\nJane Doe, 8, 5559876543'
    );

    if (!csvText) return;

    const lines = csvText.trim().split('\n');
    const playersToAdd = lines.map(line => {
      const [name, handicap, phone] = line.split(',').map(s => s.trim());
      const hc = parseInt(handicap) || 0;
      return {
        name,
        handicap: hc,
        quota: 36 - hc,
        phone: phone || null
      };
    });

    try {
      const { error } = await supabase
        .from('saved_players')
        .insert(playersToAdd);

      if (error) throw error;

      alert(`Added ${playersToAdd.length} players`);
      loadPlayers();
    } catch (error: any) {
      console.error('Error importing players:', error);
      alert('Failed to import players');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Saved Players</h2>
          <p className="text-gray-600 mt-1">Manage your player database - {players.length} players</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            Copy from Tournament
          </button>
          <button
            onClick={handleBulkImport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        </div>
      </div>

      {/* Copy from Tournament Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Copy Players from Tournament</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select a tournament to copy players into the database. Existing players will be updated with newest handicap/quota.
              </p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Tournament
                </label>
                <select
                  value={selectedTournament}
                  onChange={(e) => handleTournamentSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select a Tournament --</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.tournament_date ? `(${t.tournament_date})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {loadingTournamentPlayers && (
                <p className="text-center text-gray-600 py-4">Loading players...</p>
              )}

              {!loadingTournamentPlayers && tournamentPlayers.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {tournamentPlayers.length} players found - all will be copied/updated:
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Handicap</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Quota</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Phone</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {tournamentPlayers.map(player => {
                          const exists = players.find(
                            p => p.name.toLowerCase() === player.name.toLowerCase()
                          );
                          return (
                            <tr key={player.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{player.name}</td>
                              <td className="px-4 py-2 text-center">{player.handicap}</td>
                              <td className="px-4 py-2 text-center">{player.quota || (36 - player.handicap)}</td>
                              <td className="px-4 py-2 text-center text-gray-600">
                                {player.phone ? `***-${player.phone.slice(-4)}` : '-'}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {exists ? (
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                    Update
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                    New
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!loadingTournamentPlayers && selectedTournament && tournamentPlayers.length === 0 && (
                <p className="text-center text-gray-600 py-4">No players found in this tournament</p>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedTournament('');
                  setTournamentPlayers([]);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={copyPlayersToDatabase}
                disabled={tournamentPlayers.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy {tournamentPlayers.length} Players to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Form */}
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
                  Phone
                </label>
                <input
                  type="tel"
                  value={newPlayerPhone}
                  onChange={(e) => setNewPlayerPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="5551234567"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Save Player
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

      {/* Players Table */}
      {players.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">No saved players yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Player
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Handicap</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quota</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map(player => {
                  const isEditing = editingPlayer === player.id;
                  const quota = 36 - (isEditing ? editHandicap : player.handicap);

                  return (
                    <tr key={player.id} className="hover:bg-gray-50">
                      {isEditing ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editHandicap}
                              onChange={(e) => setEditHandicap(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-center mx-auto block"
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-semibold">{quota}</td>
                          <td className="px-6 py-4">
                            <input
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full px-2 py-1 border rounded text-center"
                              placeholder="5551234567"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => saveEdit(player.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{player.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">{player.handicap}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-semibold">{quota}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                            {player.phone ? `***-***-${player.phone.slice(-4)}` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => startEdit(player)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deletePlayer(player.id, player.name)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
      )}
    </div>
  );
}