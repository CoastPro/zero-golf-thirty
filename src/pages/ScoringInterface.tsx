import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, BarChart3, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Group, Score, Tournament } from '../types/database.types';

interface GroupWithPlayers extends Group {
  players: Player[];
  round_finished?: boolean;
  finished_at?: string;
  locked_by_admin?: boolean;
}

export default function ScoringInterface() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupIdParam = searchParams.get('group');
  const isRestricted = !!groupIdParam;
  
  // Admin has unrestricted access (no group param means they came from admin dashboard)
  const isAdmin = !isRestricted;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<GroupWithPlayers[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithPlayers | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [scores, setScores] = useState<Record<string, Record<number, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Load saved hole from localStorage on mount
  useEffect(() => {
    if (id && groupIdParam) {
      const storageKey = `scoring_hole_${id}_${groupIdParam}`;
      const savedHole = localStorage.getItem(storageKey);
      if (savedHole) {
        const hole = parseInt(savedHole);
        if (hole >= 1 && hole <= 18) {
          setCurrentHole(hole);
        }
      }
    }
  }, [id, groupIdParam]);

  // Save current hole to localStorage whenever it changes
  useEffect(() => {
    if (id && groupIdParam) {
      const storageKey = `scoring_hole_${id}_${groupIdParam}`;
      localStorage.setItem(storageKey, currentHole.toString());
    }
  }, [currentHole, id, groupIdParam]);

  useEffect(() => {
    loadData();
  }, [id, groupIdParam]);

  useEffect(() => {
    if (selectedGroup) {
      loadScoresForGroup(selectedGroup.id);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (!saving && selectedGroup && Object.keys(scores).length > 0 && canEdit) {
      const timer = setTimeout(() => {
        saveScores();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [scores]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Build groups query
      let groupsQuery = supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', id);

      // If restricted to specific group, filter by group ID
      if (isRestricted && groupIdParam) {
        groupsQuery = groupsQuery.eq('id', groupIdParam);
      }

      const { data: groupsData, error: groupsError } = await groupsQuery.order('number');

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
            .map(gp => gp.players as unknown as Player)
            .filter(p => p !== null);

          return {
            ...group,
            players: groupPlayers
          };
        });

        setGroups(groupsWithPlayers);
        
        if (groupsWithPlayers.length > 0) {
          setSelectedGroup(groupsWithPlayers[0]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadScoresForGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !tournament) return;

    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .in('player_id', group.players.map(p => p.id));

      if (error) throw error;

      const scoresMap: Record<string, Record<number, number | null>> = {};
      group.players.forEach(player => {
        scoresMap[player.id] = {};
        for (let hole = 1; hole <= 18; hole++) {
          const score = data?.find(s => s.player_id === player.id && s.hole === hole);
          // Only load actual saved scores - don't pre-fill with par
          scoresMap[player.id][hole] = score?.score || null;
        }
      });

      setScores(scoresMap);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  const saveScores = async () => {
    if (!selectedGroup) return;
    
    setSaving(true);
    try {
      const scoresToUpsert: any[] = [];

      selectedGroup.players.forEach(player => {
        for (let hole = 1; hole <= 18; hole++) {
          const score = scores[player.id]?.[hole];
          if (score !== null && score !== undefined) {
            scoresToUpsert.push({
              player_id: player.id,
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
      }
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const handleFinishRound = async () => {
    if (!selectedGroup) return;

    if (!confirm('Submit round? You won\'t be able to edit scores unless admin unlocks.')) {
      return;
    }

    setFinishing(true);
    try {
      // Save any pending scores first
      await saveScores();

      // Mark group as finished
      const { error } = await supabase
        .from('groups')
        .update({
          round_finished: true,
          finished_at: new Date().toISOString()
        })
        .eq('id', selectedGroup.id);

      if (error) throw error;

      // Clear localStorage for this group
      if (id && groupIdParam) {
        const storageKey = `scoring_hole_${id}_${groupIdParam}`;
        localStorage.removeItem(storageKey);
      }

      // Redirect to leaderboard
      navigate(`/tournament/${id}/leaderboard${groupIdParam ? `?group=${groupIdParam}` : ''}`);
    } catch (error) {
      console.error('Error finishing round:', error);
      alert('Failed to finish round. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const updateScore = (playerId: string, delta: number) => {
    if (!canEdit || !tournament) return;

    setScores(prev => {
      const currentScore = prev[playerId]?.[currentHole];
      const holePar = tournament.course_par[currentHole - 1];
      
      // If no score yet (null), first click goes to PAR (not par+delta!)
      if (currentScore === null || currentScore === undefined) {
        return {
          ...prev,
          [playerId]: {
            ...prev[playerId],
            [currentHole]: holePar
          }
        };
      }
      
      // After that, normal +/- behavior
      let newScore = currentScore + delta;
      
      // Allow going from 1 down to null (blank)
      if (newScore < 1) {
        newScore = 0; // We'll treat 0 as null
      }
      
      // Cap at 10
      if (newScore > 10) {
        newScore = 10;
      }
      
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [currentHole]: newScore === 0 ? null : newScore
        }
      };
    });
  };

  const previousHole = () => {
    if (currentHole > 1) setCurrentHole(currentHole - 1);
  };

  const nextHole = () => {
    if (currentHole < 18) {
      setCurrentHole(currentHole + 1);
    } else {
      // If on hole 18 and clicking next, reset to hole 1
      setCurrentHole(1);
      if (id && groupIdParam) {
        const storageKey = `scoring_hole_${id}_${groupIdParam}`;
        localStorage.setItem(storageKey, '1');
      }
    }
  };

  // Check if scores can be edited
  // ADMIN CAN ALWAYS EDIT - Scorers respect locks
  const canEdit = isAdmin || (
    !selectedGroup?.round_finished && 
    !selectedGroup?.locked_by_admin && 
    !tournament?.finalized
  );

  // Check if all holes have been scored for all players
  const allHolesScored = selectedGroup?.players.every(player => {
    for (let hole = 1; hole <= 18; hole++) {
      if (!scores[player.id]?.[hole]) return false;
    }
    return true;
  }) || false;

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!tournament || !selectedGroup) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No groups available for scoring</p>
        {!isRestricted && (
          <Link
            to={`/admin/tournament/${id}/groups`}
            className="text-green-600 hover:text-green-700 font-semibold"
          >
            Set up groups first
          </Link>
        )}
      </div>
    );
  }

  // If tournament is finalized, ONLY BLOCK SCORERS (not admin)
  if (tournament.finalized && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-green-50 border-2 border-green-600 rounded-lg p-8">
          <Lock className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🏆 Tournament Finalized</h2>
          <p className="text-gray-600 mb-6">
            Scores are locked. View the leaderboard for final results.
          </p>
          <button
            onClick={() => navigate(`/tournament/${id}/leaderboard`)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            View Final Results
          </button>
        </div>
      </div>
    );
  }

  // If round is finished, ONLY BLOCK SCORERS (not admin)
  if (selectedGroup.round_finished && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-green-50 border-2 border-green-600 rounded-lg p-8">
          <Lock className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">✅ Round Submitted!</h2>
          <p className="text-gray-600 mb-2">
            Scores are locked.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Need to edit? Contact tournament admin to unlock this group.
          </p>
          <button
            onClick={() => navigate(`/tournament/${id}/leaderboard${groupIdParam ? `?group=${groupIdParam}` : ''}`)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    );
  }

  const holePar = tournament.course_par[currentHole - 1];

  // Get visibility settings from tournament
  const showFlight = true; // Always show flight
  const showHandicap = tournament.show_handicaps ?? true;
  const showQuota = tournament.show_quotas ?? true;

  return (
    <div className="max-w-2xl mx-auto px-2 py-2">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{tournament.name}</h2>
        
        {/* Admin Notice - Show if admin is viewing locked content */}
        {isAdmin && (selectedGroup.round_finished || tournament.finalized) && (
          <div className="mb-2 bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-xs text-blue-800">
              🔓 <strong>Admin View:</strong> This group is locked for scorers, but you can still edit.
            </p>
          </div>
        )}
        
        {/* Group Selection - Only show if NOT restricted */}
        {!isRestricted && groups.length > 1 && (
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Select Group
            </label>
            <select
              value={selectedGroup.id}
              onChange={(e) => {
                const group = groups.find(g => g.id === e.target.value);
                if (group) setSelectedGroup(group);
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  Group {group.number} ({group.players.length} players) {group.round_finished ? '✅' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sponsor Logos */}
        {(tournament.leaderboard_logo_left || tournament.leaderboard_logo_right) && (
          <div className="flex justify-between items-center px-2 py-2 mb-2">
            <div className="w-1/2 flex justify-start">
              {tournament.leaderboard_logo_left && (
                <img 
                  src={tournament.leaderboard_logo_left} 
                  alt="Sponsor" 
                  className="h-12 object-contain"
                />
              )}
            </div>
            <div className="w-1/2 flex justify-end">
              {tournament.leaderboard_logo_right && (
                <img 
                  src={tournament.leaderboard_logo_right} 
                  alt="Sponsor" 
                  className="h-12 object-contain"
                />
              )}
            </div>
          </div>
        )}

        {/* Hole Navigation - GREEN ARROWS! */}
        <div className="bg-white rounded-lg shadow p-2 mb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={previousHole}
              disabled={currentHole === 1}
              className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="flex-1 mx-2">
              <select
                value={currentHole}
                onChange={(e) => setCurrentHole(parseInt(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-bold text-center focus:ring-2 focus:ring-green-500"
              >
                {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                  <option key={hole} value={hole}>
                    Hole {hole} - Par {tournament.course_par[hole - 1]}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={nextHole}
              className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Player Scoring Cards */}
      <div className="space-y-2">
        {selectedGroup.players.map(player => {
          const savedScore = scores[player.id]?.[currentHole];
          // Show blank/dash if no score saved yet
          const displayScore = savedScore !== null && savedScore !== undefined ? savedScore : null;
          const isPlaceholder = savedScore === null || savedScore === undefined;
          
          // Build info parts array based on visibility settings
          const infoParts = [];
          if (showFlight) infoParts.push(`Flight ${player.flight}`);
          if (showHandicap) infoParts.push(`HC ${player.handicap}`);
          if (showQuota) infoParts.push(`Quota ${player.quota}`);
          const infoText = infoParts.join(' | ');
          
          return (
            <div key={player.id} className="bg-white rounded-lg shadow p-2.5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-gray-900 leading-tight">{player.name}</h3>
                {infoText && (
                  <p className="text-xs text-gray-600 text-right">
                    {infoText}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => updateScore(player.id, -1)}
                  disabled={!canEdit}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-6 h-6" />
                </button>

                <div className="text-center">
                  <div className={`text-3xl font-bold leading-none ${isPlaceholder ? 'text-gray-400' : 'text-gray-900'}`}>
                    {displayScore !== null ? displayScore : '-'}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {displayScore !== null && displayScore > 0 && (
                      <>
                        {displayScore - holePar > 0 ? '+' : ''}
                        {displayScore - holePar !== 0 ? displayScore - holePar : 'Par'}
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => updateScore(player.id, 1)}
                  disabled={!canEdit || (displayScore !== null && displayScore >= 10)}
                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Finish Round Button - ONLY SHOW FOR SCORERS (not admin) */}
      {!isAdmin && allHolesScored && canEdit && (
        <div className="mt-4">
          <button
            onClick={handleFinishRound}
            disabled={finishing}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {finishing ? 'Submitting...' : '✓ Finish & Submit Round'}
          </button>
        </div>
      )}

      {/* Auto-save indicator */}
      {saving && (
        <div className="fixed bottom-2 right-2 bg-gray-900 text-white px-3 py-1.5 rounded text-sm shadow-lg">
          Saving...
        </div>
      )}

      {/* View Leaderboard */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => navigate(`/tournament/${id}/leaderboard${groupIdParam ? `?group=${groupIdParam}` : ''}`)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          View Leaderboard
        </button>
      </div>
    </div>
  );
}