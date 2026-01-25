import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Save, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Tournament } from '../types/database.types';
import { useAuth } from '../context/AuthContext';

export default function UserManagement() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  // New user form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPin, setNewPin] = useState('');

  // Edit user form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPin, setEditPin] = useState('');

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'master_admin') {
      navigate('/admin');
      return;
    }
    loadData();
  }, [currentUser, navigate]);

  const loadData = async () => {
    try {
      // Load all sub-admins
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'sub_admin')
        .order('name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load all tournaments
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .order('name');

      if (tournamentsError) throw tournamentsError;
      setTournaments(tournamentsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPin.length !== 6) {
      alert('PIN must be exactly 6 digits');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert([{
          name: newName,
          phone: newPhone || null,
          pin: newPin,
          role: 'sub_admin'
        }]);

      if (error) throw error;

      alert('Sub-admin created successfully!');
      setNewName('');
      setNewPhone('');
      setNewPin('');
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user');
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user.id);
    setEditName(user.name);
    setEditPhone(user.phone || '');
    setEditPin(user.pin);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditName('');
    setEditPhone('');
    setEditPin('');
  };

  const saveEdit = async (userId: string) => {
    if (editPin.length !== 6) {
      alert('PIN must be exactly 6 digits');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editName,
          phone: editPhone || null,
          pin: editPin
        })
        .eq('id', userId);

      if (error) throw error;

      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete ${userName}? Their tournaments will be unassigned.`)) return;

    try {
      // Unassign tournaments first
      await supabase
        .from('tournaments')
        .update({ created_by: currentUser?.id })
        .eq('created_by', userId);

      // Delete user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      alert('User deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const assignTournament = async (tournamentId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ created_by: userId })
        .eq('id', tournamentId);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error('Error assigning tournament:', error);
      alert('Failed to assign tournament');
    }
  };

const getUserName = (userId: string | null | undefined) => {
    if (!userId) return 'Unassigned';
    if (userId === currentUser?.id) return 'Master Admin';
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage sub-admins and tournament assignments</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Sub-Admin
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Sub-Admin</h3>
          <form onSubmit={addUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="5551234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  6-Digit PIN *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="123456"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Add Sub-Admin
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

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="bg-green-600 text-white px-6 py-3">
          <h3 className="text-lg font-semibold">Sub-Admins ({users.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIN</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tournaments</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                    No sub-admins yet. Add one to get started!
                  </td>
                </tr>
              ) : (
                users.map(user => {
                  const isEditing = editingUser === user.id;
                  const userTournaments = tournaments.filter(t => t.created_by === user.id);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
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
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="5551234567"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={editPin}
                              onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                              className="w-24 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">{userTournaments.length}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => saveEdit(user.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Save className="w-4 h-4" />
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
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{user.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{user.phone || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono">{user.pin}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                              {userTournaments.length}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => startEdit(user)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteUser(user.id, user.name)}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tournament Assignment */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-green-600 text-white px-6 py-3">
          <h3 className="text-lg font-semibold">Tournament Assignments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tournament</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reassign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                    No tournaments yet
                  </td>
                </tr>
              ) : (
                tournaments.map(tournament => (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{tournament.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tournament.course_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tournament.tournament_date 
                        ? new Date(tournament.tournament_date).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        tournament.created_by === currentUser?.id
                          ? 'bg-purple-100 text-purple-800'
                          : tournament.created_by
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {getUserName(tournament.created_by)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={tournament.created_by || ''}
                        onChange={(e) => assignTournament(tournament.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                      >
                        <option value={currentUser?.id}>Master Admin</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}