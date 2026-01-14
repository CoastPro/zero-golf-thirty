import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Check, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SavedPlayer } from '../types/database.types';

export default function SavedPlayers() {
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState(0);
  
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState(0);

  useEffect(() => {
    loadPlayers();
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

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('saved_players')
        .insert([{
          name: newPlayerName,
          handicap: newPlayerHandicap
        }]);

      if (error) throw error;
      
      setNewPlayerName('');
      setNewPlayerHandicap(0);
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
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditName('');
    setEditHandicap(0);
  };

  const saveEdit = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('saved_players')
        .update({
          name: editName,
          handicap: editHandicap
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
      'Paste CSV data (Name, Handicap):\nExample:\nJohn Smith, 12\nJane Doe, 8'
    );
    
    if (!csvText) return;

    const lines = csvText.trim().split('\n');
    const playersToAdd = lines.map(line => {
      const [name, handicap] = line.split(',').map(s => s.trim());
      return {
        name,
        handicap: parseInt(handicap) || 0
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

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Player</h3>
          <form onSubmit={addPlayer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              className="w-20 px-2 py-1 border rounded text-center"
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-semibold">{quota}</td>
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