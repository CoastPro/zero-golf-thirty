import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, BarChart3, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Group, Score, Tournament } from '../types/database.types';

interface GroupWithPlayers extends Group {
  players: Player[];
}

export default function ScoringInterface() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const groupIdParam = searchParams.get('group');
  const isRestricted = !!groupIdParam;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<GroupWithPlayers[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithPlayers | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [scores, setScores] = useState<Record<string, Record<number, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFlight, setShowFlight] = useState(true);
  const [showHandicap, setShowHandicap] = useState(true);
  const [showQuota, setShowQuota] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

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
    if (!saving && selectedGroup && Object.keys(scores).length > 0) {
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
    if (!group) return;

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

  const updateScore = (playerId: string, delta: number) => {
    setScores(prev => {
      const currentScore = prev[playerId]?.[currentHole] || 0;
      const newScore = Math.max(1, Math.min(10, currentScore + delta));
      
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [currentHole]: newScore
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

  const holePar = tournament.course_par[currentHole - 1];

  return (
    <div className="max-w-2xl mx-auto px-2 py-2">
      <div className="mb-2">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-lg font-bold text-gray-900">{tournament.name}</h2>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs transition-colors"
          >
            {showOptions ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Display Options */}
        {showOptions && (
          <div className="bg-white rounded-lg shadow p-2 mb-2 border border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-1.5">Show/Hide Player Info</div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFlight(!showFlight)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showFlight
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {showFlight ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Flight
              </button>
              <button
                onClick={() => setShowHandicap(!showHandicap)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showHandicap
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {showHandicap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Handicap
              </button>
              <button
                onClick={() => setShowQuota(!showQuota)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showQuota
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {showQuota ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Quota
              </button>
            </div>
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
                  Group {group.number} ({group.players.length} players)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hole Navigation */}
        <div className="bg-white rounded-lg shadow p-2 mb-2">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={previousHole}
              disabled={currentHole === 1}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
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
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">Hole {currentHole}</div>
            <div className="text-sm text-gray-600">Par {holePar}</div>
          </div>
        </div>
      </div>

      {/* Player Scoring Cards */}
      <div className="space-y-2">
        {selectedGroup.players.map(player => {
          const playerScore = scores[player.id]?.[currentHole] || 0;
          
          // Build info parts array
          const infoParts = [];
          if (showFlight) infoParts.push(`Flight ${player.flight}`);
          if (showHandicap) infoParts.push(`HC ${player.handicap}`);
          if (showQuota && player.quota) infoParts.push(`Quota ${player.quota}`);
          const infoText = infoParts.join(' | ');
          
          return (
            <div key={player.id} className="bg-white rounded-lg shadow p-2.5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">{player.name}</h3>
                  {infoText && (
                    <p className="text-xs text-gray-600">
                      {infoText}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => updateScore(player.id, -1)}
                  disabled={playerScore <= 1}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-6 h-6" />
                </button>

                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 leading-none">
                    {playerScore || '-'}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {playerScore > 0 && (
                      <>
                        {playerScore - holePar > 0 ? '+' : ''}
                        {playerScore - holePar !== 0 ? playerScore - holePar : 'Par'}
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => updateScore(player.id, 1)}
                  disabled={playerScore >= 10}
                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-save indicator */}
      {saving && (
        <div className="fixed bottom-2 right-2 bg-gray-900 text-white px-3 py-1.5 rounded text-sm shadow-lg">
          Saving...
        </div>
      )}

      {/* View Leaderboard */}
      <div className="mt-4 flex justify-center">
        <Link
          to={`/tournament/${id}/leaderboard${groupIdParam ? `?group=${groupIdParam}` : ''}`}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}