import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, LogOut, UserCog, Eye, EyeOff, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament, User, TournamentAccess } from '../types/database.types';
import { useAuth } from '../context/AuthContext';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tournamentAccess, setTournamentAccess] = useState<TournamentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      // Load all users (for sharing dropdown)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) throw usersError;
      setAllUsers(usersData || []);

      // Load tournament access permissions
      const { data: accessData, error: accessError } = await supabase
        .from('tournament_access')
        .select('*');

      if (accessError) throw accessError;
      setTournamentAccess(accessData || []);

      // Load tournaments based on user role
      let query = supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

if (user?.role === 'sub_admin') {
  // Sub-admin sees: tournaments they created + tournaments shared with them
  const { data: sharedTournamentIds } = await supabase
    .from('tournament_access')
    .select('tournament_id')
    .eq('user_id', user.id);

  const sharedIds = sharedTournamentIds?.map(t => t.tournament_id) || [];

  // Build query differently based on whether there are shared tournaments
  let subAdminQuery = supabase
    .from('tournaments')
    .select('*');

  if (sharedIds.length > 0) {
    // Has shared tournaments: created_by OR in shared list
    subAdminQuery = subAdminQuery.or(`created_by.eq.${user.id},id.in.(${sharedIds.join(',')})`);
  } else {
    // No shared tournaments: only created_by
    subAdminQuery = subAdminQuery.eq('created_by', user.id);
  }

  const { data: tournamentsData, error: tournamentsError } = await subAdminQuery
    .order('created_at', { ascending: false });

  if (tournamentsError) throw tournamentsError;
  setTournaments(tournamentsData || []);
}

else {
        // Master admin sees all tournaments
        const { data, error } = await query;
        if (error) throw error;
        setTournaments(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const toggleVisibility = async (tournamentId: string, currentVisibility: boolean) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ visible_to_players: !currentVisibility })
        .eq('id', tournamentId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    }
  };

  const toggleUserAccess = async (tournamentId: string, userId: string) => {
    try {
      // Check if access already exists
      const hasAccess = tournamentAccess.some(
        a => a.tournament_id === tournamentId && a.user_id === userId
      );

      if (hasAccess) {
        // Remove access
        const { error } = await supabase
          .from('tournament_access')
          .delete()
          .eq('tournament_id', tournamentId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Grant access
        const { error } = await supabase
          .from('tournament_access')
          .insert({
            tournament_id: tournamentId,
            user_id: userId,
            granted_by: user?.id
          });

        if (error) throw error;
      }

      loadData();
    } catch (error) {
      console.error('Error toggling access:', error);
      alert('Failed to update access');
    }
  };

  const deleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Are you sure you want to delete "${tournamentName}"? This will delete all players, groups, and scores. This cannot be undone!`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      alert('Tournament deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament');
    }
  };

  const getSharedUsers = (tournamentId: string): User[] => {
    const accessRecords = tournamentAccess.filter(a => a.tournament_id === tournamentId);
    return allUsers.filter(u => 
      accessRecords.some(a => a.user_id === u.id) && u.role === 'sub_admin'
    );
  };

  const canManageTournament = (tournament: Tournament): boolean => {
    if (user?.role === 'master_admin') return true;
    if (tournament.created_by === user?.id) return true;
    return tournamentAccess.some(
      a => a.tournament_id === tournament.id && a.user_id === user?.id
    );
  };

  if (!user) return null;

  const subAdmins = allUsers.filter(u => u.role === 'sub_admin');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome, {user.name} {user.role === 'master_admin' && '(Master Admin)'}
              </p>
            </div>
            <div className="flex gap-3">
              {user.role === 'master_admin' && (
                <Link
                  to="/admin/users"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <UserCog className="w-5 h-5" />
                  Manage Users
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Tournaments</h2>
          <Link
            to="/admin/tournament/new"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading tournaments...</div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
            <p className="text-gray-600 mb-6">Create your first tournament to get started</p>
            <Link
              to="/admin/tournament/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tournaments.map(tournament => {
              const sharedUsers = getSharedUsers(tournament.id);
              const isOwner = tournament.created_by === user?.id;
              const isMaster = user?.role === 'master_admin';
              const canManage = canManageTournament(tournament);

              return (
                <div
                  key={tournament.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 border-transparent hover:border-green-500"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {tournament.name}
                        </h3>
                        <button
                          onClick={() => toggleVisibility(tournament.id, tournament.visible_to_players)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            tournament.visible_to_players
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={tournament.visible_to_players ? 'Visible to players' : 'Hidden from players'}
                        >
                          {tournament.visible_to_players ? (
                            <>
                              <Eye className="w-4 h-4" />
                              Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4" />
                              Hidden
                            </>
                          )}
                        </button>
                      </div>
                      {tournament.course_name && (
                        <p className="text-sm text-gray-600 mb-2">{tournament.course_name}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {tournament.tournament_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(tournament.tournament_date).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {tournament.flights.length} Flight{tournament.flights.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sharing Section - Only for Master Admin and Owner */}
                  {(isMaster || isOwner) && subAdmins.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Share2 className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Share with Sub-Admins:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subAdmins.map(subAdmin => {
                          const hasAccess = tournamentAccess.some(
                            a => a.tournament_id === tournament.id && a.user_id === subAdmin.id
                          );
                          const isCreator = tournament.created_by === subAdmin.id;

                          return (
                            <button
                              key={subAdmin.id}
                              onClick={() => !isCreator && toggleUserAccess(tournament.id, subAdmin.id)}
                              disabled={isCreator}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                isCreator
                                  ? 'bg-purple-100 text-purple-700 cursor-default'
                                  : hasAccess
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {subAdmin.name} {isCreator && '(Owner)'}
                            </button>
                          );
                        })}
                      </div>
                      {sharedUsers.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Shared with: {sharedUsers.map(u => u.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Link
                          to={`/admin/tournament/${tournament.id}/players`}
                          className="flex-1 text-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
                        >
                          Manage
                        </Link>
                        <Link
                          to={`/admin/tournament/${tournament.id}/edit`}
                          className="flex-1 text-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => deleteTournament(tournament.id, tournament.name)}
                          className="flex-1 text-center px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <Link
                      to={`/tournament/${tournament.id}/leaderboard`}
                      className="flex-1 text-center px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium text-sm transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}