import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, LogOut, UserCog, Eye, EyeOff, Share2, Lock, Unlock, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Tournament, User, TournamentAccess, Player, Score, Group } from '../types/database.types';
import { useAuth } from '../context/AuthContext';
import { buildLeaderboard, buildSkinsLeaderboard } from '../lib/calculations';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tournamentAccess, setTournamentAccess] = useState<TournamentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
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
      } else {
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

  const finalizeTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Finalize "${tournamentName}"?\n\nThis will:\n- Lock ALL scores across all groups\n- Prevent any further edits\n\nYou can unlock later if needed.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          finalized: true,
          finalized_at: new Date().toISOString(),
          finalized_by: user?.id
        })
        .eq('id', tournamentId);

      if (error) throw error;

      alert('✅ Tournament finalized! All scores are now locked.');
      loadData();
    } catch (error) {
      console.error('Error finalizing tournament:', error);
      alert('Failed to finalize tournament');
    }
  };

  const unlockTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Unlock "${tournamentName}"?\n\nThis will:\n- Unlock the tournament\n- Unlock ALL groups\n- Allow scores to be edited again`)) {
      return;
    }

    try {
      // Unlock the tournament
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({
          finalized: false,
          finalized_at: null,
          finalized_by: null
        })
        .eq('id', tournamentId);

      if (tournamentError) throw tournamentError;

      // Unlock all groups in this tournament
      const { error: groupsError } = await supabase
        .from('groups')
        .update({
          round_finished: false,
          finished_at: null,
          locked_by_admin: false
        })
        .eq('tournament_id', tournamentId);

      if (groupsError) throw groupsError;

      alert('🔓 Tournament unlocked! All groups can edit scores again.');
      loadData();
    } catch (error) {
      console.error('Error unlocking tournament:', error);
      alert('Failed to unlock tournament');
    }
  };

  const exportToExcel = async (tournamentId: string, tournamentName: string) => {
    setExporting(tournamentId);
    try {
      // Fetch all tournament data
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (playersError) throw playersError;

      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('player_id', (players || []).map(p => p.id));

      if (scoresError) throw scoresError;

      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('number');

      if (groupsError) throw groupsError;

      const { data: groupPlayers, error: gpError } = await supabase
        .from('group_players')
        .select('*')
        .in('group_id', (groups || []).map(g => g.id));

      if (gpError) throw gpError;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // SHEET 1: FINAL STANDINGS
      const leaderboard = buildLeaderboard(players || [], scores || [], tournament, null);
      const standingsData = leaderboard.map((entry, index) => ({
        'Rank': entry.holesPlayed === 0 ? '-' : index + 1,
        'Player': entry.player.name,
        'Flight': entry.player.flight,
        'Handicap': entry.player.handicap,
        'Quota': entry.player.quota,
        'Holes Played': entry.holesPlayed,
        'Gross Score': entry.holesPlayed > 0 ? entry.grossScore : '-',
        'vs Par (Gross)': entry.holesPlayed > 0 ? (entry.vsParGross > 0 ? `+${entry.vsParGross}` : entry.vsParGross) : '-',
        'Net Score': entry.netScore !== null ? entry.netScore : '-',
        'vs Par (Net)': entry.vsParNet !== null ? (entry.vsParNet > 0 ? `+${entry.vsParNet}` : entry.vsParNet) : '-',
        'Stableford Points': entry.holesPlayed > 0 ? entry.stablefordPoints : '-',
        'vs Quota': entry.holesPlayed > 0 ? (entry.vsQuota > 0 ? `+${entry.vsQuota.toFixed(1)}` : entry.vsQuota.toFixed(1)) : '-'
      }));

      const standingsSheet = XLSX.utils.json_to_sheet(standingsData);
      XLSX.utils.book_append_sheet(wb, standingsSheet, 'Final Standings');

      // SHEET 2: HOLE BY HOLE SCORES
      const holeByHoleData: any[] = [];
      (players || []).forEach(player => {
        const playerScores = (scores || []).filter(s => s.player_id === player.id);
        const row: any = {
          'Player': player.name,
          'Flight': player.flight,
          'Handicap': player.handicap
        };
        
        for (let hole = 1; hole <= 18; hole++) {
          const score = playerScores.find(s => s.hole === hole);
          row[`Hole ${hole}`] = score?.score || '-';
        }
        
        const totalScore = playerScores.reduce((sum, s) => sum + (s.score || 0), 0);
        row['Total'] = playerScores.length > 0 ? totalScore : '-';
        
        holeByHoleData.push(row);
      });

      const holeByHoleSheet = XLSX.utils.json_to_sheet(holeByHoleData);
      XLSX.utils.book_append_sheet(wb, holeByHoleSheet, 'Hole by Hole');

      // SHEET 3: SKINS (if enabled)
      if (tournament.skins_enabled) {
        const skinsData = buildSkinsLeaderboard(players || [], scores || [], tournament);
        
        const skinsLeaderboardData = skinsData.leaderboard.map((entry, index) => ({
          'Rank': index + 1,
          'Player': entry.player.name,
          'Flight': entry.player.flight,
          'Skins Won': entry.skins,
          'Holes': entry.holes.sort((a, b) => a - b).join(', '),
          'Winnings': `$${entry.winnings.toFixed(2)}`
        }));

        const skinsSheet = XLSX.utils.json_to_sheet(skinsLeaderboardData);
        XLSX.utils.book_append_sheet(wb, skinsSheet, 'Skins');

        // Add skins summary
        const skinsSummary = [
          { 'Summary': 'Total Pot', 'Value': `$${skinsData.totalPot.toFixed(2)}` },
          { 'Summary': 'Skins Won', 'Value': skinsData.skinsWon },
          { 'Summary': 'Value Per Skin', 'Value': `$${skinsData.valuePerSkin.toFixed(2)}` },
          { 'Summary': 'Type', 'Value': tournament.skins_type.toUpperCase() }
        ];
        
        XLSX.utils.sheet_add_json(skinsSheet, skinsSummary, { origin: -1, skipHeader: false });
      }

      // SHEET 4: GROUPS
      const groupsData = (groups || []).map(group => {
        const groupPlayersList = (groupPlayers || [])
          .filter(gp => gp.group_id === group.id)
          .map(gp => {
            const player = (players || []).find(p => p.id === gp.player_id);
            return player ? `${player.name} (Cart ${gp.cart_number || '-'})` : '';
          })
          .join(', ');

        return {
          'Group': group.number,
          'Starting Hole': group.starting_hole || '-',
          'Tee Position': group.starting_position || '-',
          'Tee Time': group.tee_time || '-',
          'Players': groupPlayersList,
          'Status': group.round_finished ? 'Finished' : 'In Progress'
        };
      });

      const groupsSheet = XLSX.utils.json_to_sheet(groupsData);
      XLSX.utils.book_append_sheet(wb, groupsSheet, 'Groups');

      // SHEET 5: COURSE INFO
      const courseData = tournament.course_par.map((par, index) => ({
        'Hole': index + 1,
        'Par': par
      }));

      // Add totals
      const frontNine = tournament.course_par.slice(0, 9).reduce((a, b) => a + b, 0);
      const backNine = tournament.course_par.slice(9, 18).reduce((a, b) => a + b, 0);
      
      courseData.push({ 'Hole': 'OUT', 'Par': frontNine });
      courseData.push({ 'Hole': 'IN', 'Par': backNine });
      courseData.push({ 'Hole': 'TOTAL', 'Par': frontNine + backNine });

      const courseSheet = XLSX.utils.json_to_sheet(courseData);
      XLSX.utils.book_append_sheet(wb, courseSheet, 'Course Info');

      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      const filename = `${tournamentName.replace(/[^a-z0-9]/gi, '_')}_Results_${date}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      alert('✅ Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel');
    } finally {
      setExporting(null);
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

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No date';
    // Add T00:00:00 to force local timezone interpretation
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString();
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
                  className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 ${
                    tournament.finalized 
                      ? 'border-red-500' 
                      : 'border-transparent hover:border-green-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {tournament.name}
                        </h3>
                        
                        {/* FINALIZED BADGE */}
                        {tournament.finalized && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-bold">
                            <Lock className="w-4 h-4" />
                            FINALIZED
                          </span>
                        )}

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
                            {formatDate(tournament.tournament_date)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {tournament.flights.length} Flight{tournament.flights.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      {/* Show finalized timestamp */}
                      {tournament.finalized && tournament.finalized_at && (
                        <p className="text-xs text-red-600 mt-2">
                          🔒 Finalized: {new Date(tournament.finalized_at).toLocaleString()}
                        </p>
                      )}
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
                        <p className="text-xs text-gray-500 text-center mt-1">
                          {`${window.location.origin}/tournament/${tournament.slug || tournament.id}/login`}
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
                        
                        {/* EXPORT TO EXCEL BUTTON */}
                        <button
                          onClick={() => exportToExcel(tournament.id, tournament.name)}
                          disabled={exporting === tournament.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          {exporting === tournament.id ? 'Exporting...' : 'Excel'}
                        </button>
                        
                        {/* FINALIZE / UNLOCK BUTTON */}
                        {tournament.finalized ? (
                          <button
                            onClick={() => unlockTournament(tournament.id, tournament.name)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium text-sm transition-colors"
                          >
                            <Unlock className="w-4 h-4" />
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => finalizeTournament(tournament.id, tournament.name)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium text-sm transition-colors"
                          >
                            <Lock className="w-4 h-4" />
                            Finalize
                          </button>
                        )}
                        
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