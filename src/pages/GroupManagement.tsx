import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowRight, Trash2, Clock, Target, QrCode, Download, Link2, Check, Printer, FileText, Edit2, X, Lock, Unlock } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { Player, Group, Tournament } from '../types/database.types';
import PrintableScorecard from '../components/PrintableScorecard';
import PrintableCartPlacard from '../components/PrintableCartPlacard';
import PrintableAllScorecards from '../components/PrintableAllScorecards';

interface GroupWithPlayers extends Group {
  players: (Player & { position: number; cart_number: number | null })[];
  round_finished?: boolean;
  finished_at?: string;
  locked_by_admin?: boolean;
}

export default function GroupManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<GroupWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [numGroupsToCreate, setNumGroupsToCreate] = useState(10);
  const [startType, setStartType] = useState<'shotgun' | 'teetimes'>('shotgun');
  const [useMultipleTees, setUseMultipleTees] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [printScorecardGroupId, setPrintScorecardGroupId] = useState<string | null>(null);
  const [printPlacardGroupId, setPrintPlacardGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupNumber, setEditingGroupNumber] = useState<number>(0);

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

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', id)
        .order('number');

      if (groupsError) throw groupsError;

      if (groupsData && groupsData.length > 0) {
        const { data: groupPlayersData, error: gpError } = await supabase
          .from('group_players')
          .select('*, players(*)')
          .in('group_id', groupsData.map(g => g.id));

        if (gpError) throw gpError;

        const groupsWithPlayers = groupsData.map(group => {
          const groupPlayers = (groupPlayersData || [])
            .filter(gp => gp.group_id === group.id)
            .map(gp => ({
              ...(gp.players as unknown as Player),
              position: gp.position,
              cart_number: gp.cart_number
            }))
            .sort((a, b) => a.position - b.position);

          return {
            ...group,
            players: groupPlayers
          };
        });

        setGroups(groupsWithPlayers);

        if (groupsData.some(g => g.starting_position)) {
          setUseMultipleTees(true);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createGroups = async (count: number) => {
    try {
      const { data: latestGroups, error: fetchError } = await supabase
        .from('groups')
        .select('number')
        .eq('tournament_id', id)
        .order('number', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const highestGroupNumber = latestGroups && latestGroups.length > 0
        ? latestGroups[0].number
        : 0;

      const groupsToCreate = Array.from({ length: count }, (_, i) => ({
        tournament_id: id,
        number: highestGroupNumber + i + 1
      }));

      const { error } = await supabase
        .from('groups')
        .insert(groupsToCreate);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error creating groups:', error);
      alert('Failed to create groups');
    }
  };

  const addSingleGroup = async () => {
    await createGroups(1);
  };

  const updateGroupNumber = async (groupId: string, newNumber: number) => {
    try {
      const existingGroup = groups.find(g => g.number === newNumber && g.id !== groupId);
      if (existingGroup) {
        alert(`Group ${newNumber} already exists!`);
        return;
      }

      const { error } = await supabase
        .from('groups')
        .update({ number: newNumber })
        .eq('id', groupId);

      if (error) throw error;
      setEditingGroupId(null);
      loadData();
    } catch (error) {
      console.error('Error updating group number:', error);
      alert('Failed to update group number');
    }
  };

  const deleteGroup = async (groupId: string, groupNumber: number) => {
    if (!confirm(`Delete Group ${groupNumber}?`)) return;

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group');
    }
  };

  const unlockGroup = async (groupId: string, groupNumber: number) => {
    if (!confirm(`Unlock Group ${groupNumber}? Scorer will be able to edit scores again.`)) return;

    try {
      const { error } = await supabase
        .from('groups')
        .update({
          round_finished: false,
          finished_at: null,
          locked_by_admin: false
        })
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error unlocking group:', error);
      alert('Failed to unlock group');
    }
  };

  const assignPlayer = async (groupId: string, playerId: string, position: number) => {
    try {
      await supabase
        .from('group_players')
        .delete()
        .eq('player_id', playerId);

      const { error } = await supabase
        .from('group_players')
        .insert([{
          group_id: groupId,
          player_id: playerId,
          position,
          cart_number: null
        }]);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error assigning player:', error);
      alert('Failed to assign player');
    }
  };

  const removePlayer = async (groupId: string, playerId: string) => {
    try {
      const { error } = await supabase
        .from('group_players')
        .delete()
        .match({ group_id: groupId, player_id: playerId });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player');
    }
  };

  const updateCartNumber = async (groupId: string, playerId: string, cartNumber: number | null) => {
    try {
      const { error } = await supabase
        .from('group_players')
        .update({ cart_number: cartNumber })
        .match({ group_id: groupId, player_id: playerId });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating cart number:', error);
      alert('Failed to update cart number');
    }
  };

  const autoAssignCarts = async (groupId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      for (let i = 0; i < group.players.length; i++) {
        const player = group.players[i];
        const cartNumber = i < 2 ? 1 : 2;

        await supabase
          .from('group_players')
          .update({ cart_number: cartNumber })
          .match({ group_id: groupId, player_id: player.id });
      }

      loadData();
    } catch (error) {
      console.error('Error auto-assigning carts:', error);
      alert('Failed to auto-assign carts');
    }
  };

  const updateStartingHole = async (groupId: string, hole: number | null) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ starting_hole: hole })
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating starting hole:', error);
      alert('Failed to update starting hole');
    }
  };

  const updateStartingPosition = async (groupId: string, position: string | null) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ starting_position: position })
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating starting position:', error);
      alert('Failed to update starting position');
    }
  };

  const updateTeeTime = async (groupId: string, time: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ tee_time: time })
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating tee time:', error);
      alert('Failed to update tee time');
    }
  };

  const generateQRCode = async () => {
    if (!tournament) return;
    setGeneratingQR('tournament');
    try {
      const loginUrl = `${window.location.origin}/tournament/${tournament.slug}/login`;
      const qrDataUrl = await QRCode.toDataURL(loginUrl, {
        width: 500,
        margin: 2,
        color: {
          dark: '#166534',
          light: '#FFFFFF'
        }
      });

      const { error } = await supabase
        .from('tournaments')
        .update({ tournament_qr_code: qrDataUrl })
        .eq('id', id);

      if (error) throw error;
      loadData();
      alert('QR Code generated successfully!');
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    } finally {
      setGeneratingQR(null);
    }
  };

  const downloadQRCode = () => {
    if (!tournament?.tournament_qr_code) return;
    const link = document.createElement('a');
    link.href = tournament.tournament_qr_code;
    link.download = `${tournament.name}-qr-code.png`;
    link.click();
  };

  const copyLoginLink = async () => {
    if (!tournament) return;
    const loginUrl = `${window.location.origin}/tournament/${tournament.slug}/login`;

    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedGroupId('tournament');
      setTimeout(() => setCopiedGroupId(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy link to clipboard');
    }
  };

  const autoAssignShotgun = async () => {
    if (!confirm('Auto-assign groups to holes 1-18? This will overwrite existing assignments.')) return;

    try {
      for (let i = 0; i < groups.length; i++) {
        const hole = (i % 18) + 1;
        const position = useMultipleTees && i >= 18 ? 'B' : null;

        await supabase
          .from('groups')
          .update({
            starting_hole: hole,
            starting_position: position
          })
          .eq('id', groups[i].id);
      }

      loadData();
    } catch (error) {
      console.error('Error auto-assigning shotgun:', error);
      alert('Failed to auto-assign shotgun start');
    }
  };

  const autoAssignTeeTimes = async () => {
    try {
      const [hours, minutes] = startTime.split(':').map(Number);

      for (let i = 0; i < groups.length; i++) {
        const totalMinutes = hours * 60 + minutes + (i * intervalMinutes);
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMins = totalMinutes % 60;
        const teeTime = `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;

        await supabase
          .from('groups')
          .update({ tee_time: teeTime })
          .eq('id', groups[i].id);
      }

      loadData();
      alert('Tee times assigned successfully!');
    } catch (error) {
      console.error('Error auto-assigning tee times:', error);
      alert('Failed to auto-assign tee times');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!tournament) {
    return <div className="text-center py-12">Tournament not found</div>;
  }

  const assignedPlayerIds = new Set(
    groups.flatMap(g => g.players.map(p => p.id))
  );

  const unassignedPlayers = players.filter(p => !assignedPlayerIds.has(p.id));
  const finishedCount = groups.filter(g => g.round_finished).length;

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{tournament.name}</h2>
          <p className="text-gray-600 mt-1">
            Group Management - {groups.length} groups, {unassignedPlayers.length} unassigned players
          </p>
          {finishedCount > 0 && (
            <p className="text-green-600 font-semibold mt-1">
              ✅ {finishedCount} of {groups.length} groups finished
            </p>
          )}
        </div>

        {/* Tournament QR Code - shows at top right once generated */}
        {tournament.tournament_qr_code && (
          <div className="flex flex-col items-center bg-white rounded-lg shadow p-4 gap-2">
            <p className="text-sm font-semibold text-gray-700">Tournament Login QR Code</p>
            <img
              src={tournament.tournament_qr_code}
              alt="Tournament QR Code"
              className="w-32 h-32"
            />
            <button
              onClick={downloadQRCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download QR Code
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create Groups</h3>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Number of groups to create:
            </label>
            <input
              type="number"
              value={numGroupsToCreate}
              onChange={(e) => setNumGroupsToCreate(parseInt(e.target.value) || 1)}
              min="1"
              max="36"
              className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => createGroups(numGroupsToCreate)}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Groups
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Starting Format</h3>
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setStartType('shotgun')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  startType === 'shotgun'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Target className="w-5 h-5" />
                Shotgun Start
              </button>
              <button
                onClick={() => setStartType('teetimes')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  startType === 'teetimes'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Clock className="w-5 h-5" />
                Tee Times
              </button>
            </div>

            {startType === 'shotgun' ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useMultipleTees}
                    onChange={(e) => setUseMultipleTees(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="font-medium">Multiple groups per hole (A/B tees)</span>
                </label>
                <button
                  onClick={autoAssignShotgun}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Auto-Assign Starting Holes
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Tee Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interval (minutes)
                    </label>
                    <select
                      value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value={7}>7 minutes</option>
                      <option value={8}>8 minutes</option>
                      <option value={9}>9 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={12}>12 minutes</option>
                      <option value={15}>15 minutes</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={autoAssignTeeTimes}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Auto-Assign Tee Times
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {unassignedPlayers.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <Users className="w-5 h-5" />
                <span className="font-semibold">
                  {unassignedPlayers.length} Unassigned Player{unassignedPlayers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Assign players to groups using the dropdowns below
              </p>
            </div>
          )}

          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.id} className="bg-white rounded-lg shadow">
                <div className="bg-green-600 text-white px-6 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {editingGroupId === group.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Group</span>
                        <input
                          type="number"
                          value={editingGroupNumber}
                          onChange={(e) => setEditingGroupNumber(parseInt(e.target.value) || 1)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              updateGroupNumber(group.id, editingGroupNumber);
                            }
                          }}
                          min="1"
                          className="w-16 px-2 py-1 text-gray-900 rounded text-center"
                          autoFocus
                        />
                        <button
                          onClick={() => updateGroupNumber(group.id, editingGroupNumber)}
                          className="p-1 bg-green-700 hover:bg-green-800 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="p-1 bg-red-600 hover:bg-red-700 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">Group {group.number}</h3>
                        <button
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setEditingGroupNumber(group.number);
                          }}
                          className="p-1 hover:bg-green-700 rounded"
                          title="Edit group number"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {group.round_finished ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Finished
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          In Progress
                        </span>
                      )}
                      {group.locked_by_admin && (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}
                    </div>

                    {startType === 'shotgun' ? (
                      <div className="flex items-center gap-2">
                        <label className="text-sm">Hole:</label>
                        <select
                          value={group.starting_hole || ''}
                          onChange={(e) => updateStartingHole(group.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="px-2 py-1 text-gray-900 rounded"
                        >
                          <option value="">-</option>
                          {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        {useMultipleTees && (
                          <>
                            <label className="text-sm ml-2">Tee:</label>
                            <select
                              value={group.starting_position || ''}
                              onChange={(e) => updateStartingPosition(group.id, e.target.value || null)}
                              className="px-2 py-1 text-gray-900 rounded"
                            >
                              <option value="">-</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                            </select>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="text-sm">Tee Time:</label>
                        <input
                          type="time"
                          value={group.tee_time || ''}
                          onChange={(e) => updateTeeTime(group.id, e.target.value)}
                          className="px-2 py-1 text-gray-900 rounded"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {group.round_finished && (
                      <button
                        onClick={() => unlockGroup(group.id, group.number)}
                        className="p-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                        title="Unlock Group"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setPrintScorecardGroupId(group.id)}
                      className="p-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                      title="Save Scorecard as PDF"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPrintPlacardGroupId(group.id)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                      title="Print Cart Placards"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={copyLoginLink}
                      className="p-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                      title="Copy Login Link"
                    >
                      {copiedGroupId === 'tournament' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id, group.number)}
                      className="p-2 hover:bg-green-700 rounded transition-colors"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {group.round_finished && group.finished_at && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        ✅ Round submitted: {new Date(group.finished_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {group.players.length > 0 && (
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={() => autoAssignCarts(group.id)}
                        className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                      >
                        Auto-Assign Carts (Players 1-2 → Cart 1, Players 3-4 → Cart 2)
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(position => {
                      const assignedPlayer = group.players.find(p => p.position === position);

                      const availablePlayers = players.filter(p => {
                        const playerInThisGroup = group.players.find(gp => gp.id === p.id);
                        return p.id === assignedPlayer?.id || !playerInThisGroup;
                      });

                      return (
                        <div key={position} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 w-20">
                            Player {position}:
                          </span>
                          <select
                            value={assignedPlayer?.id || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                assignPlayer(group.id, e.target.value, position);
                              } else if (assignedPlayer) {
                                removePlayer(group.id, assignedPlayer.id);
                              }
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">-- Select Player --</option>
                            {availablePlayers.map(player => {
                              const playerGroup = groups.find(g => g.players.some(p => p.id === player.id));
                              const isInDifferentGroup = playerGroup && playerGroup.id !== group.id;

                              return (
                                <option key={player.id} value={player.id}>
                                  {player.name} (Flight {player.flight}, Quota {player.quota})
                                  {isInDifferentGroup && ` [Currently in Group ${playerGroup.number}]`}
                                </option>
                              );
                            })}
                          </select>

                          {assignedPlayer && (
                            <>
                              <select
                                value={assignedPlayer.cart_number || ''}
                                onChange={(e) => updateCartNumber(
                                  group.id,
                                  assignedPlayer.id,
                                  e.target.value ? parseInt(e.target.value) : null
                                )}
                                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                              >
                                <option value="">No Cart</option>
                                <option value="1">Cart 1</option>
                                <option value="2">Cart 2</option>
                              </select>

                              <button
                                onClick={() => removePlayer(group.id, assignedPlayer.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove from group"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action Buttons */}
          <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={addSingleGroup}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add A Group
              </button>

              <button
                onClick={generateQRCode}
                disabled={generatingQR === 'tournament'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <QrCode className="w-5 h-5" />
                {generatingQR === 'tournament'
                  ? 'Generating...'
                  : tournament?.tournament_qr_code
                  ? 'Regenerate QR Code'
                  : 'Generate QR Code'}
              </button>

              <button
                onClick={copyLoginLink}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                {copiedGroupId === 'tournament' ? (
                  <><Check className="w-5 h-5" />Copied!</>
                ) : (
                  <><Link2 className="w-5 h-5" />Copy Login Link</>
                )}
              </button>

              <button
                onClick={() => setPrintScorecardGroupId('all')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <Printer className="w-5 h-5" />
                Save All Scorecards as PDF
              </button>
            </div>

            {unassignedPlayers.length === 0 && groups.length > 0 && (
              <button
                onClick={() => navigate(`/tournament/${id}/score`)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Next: Start Scoring
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </>
      )}

      {printScorecardGroupId && printScorecardGroupId !== 'all' && (
        <PrintableScorecard
          groupId={printScorecardGroupId}
          onClose={() => setPrintScorecardGroupId(null)}
        />
      )}

{printScorecardGroupId === 'all' && (
  <PrintableAllScorecards
    tournamentId={id!}
    onClose={() => setPrintScorecardGroupId(null)}
  />
)}
    </div>
  );
} 
