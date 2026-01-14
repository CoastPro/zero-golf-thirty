import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, BarChart3 } from 'lucide-react';
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
    if (currentHole < 18) setCurrentHole(currentHole + 1);
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{tournament.name}</h2>
        
        {/* Group Selection - Only show if NOT restricted */}
        {!isRestricted && groups.length > 1 ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Group
            </label>
            <select
              value={selectedGroup.id}
              onChange={(e) => {
                const group = groups.find(g => g.id === e.target.value);
                if (group) setSelectedGroup(group);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-green-500"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  Group {group.number} ({group.players.length} players)
                </option>
              ))}
            </select>
          </div>
        ) : isRestricted && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">
              🔒 Scoring for Group {selectedGroup.number} only
            </p>
          </div>
        )}

        {/* Hole Navigation */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={previousHole}
              disabled={currentHole === 1}
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="flex-1 mx-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Select Hole
              </label>
              <select
                value={currentHole}
                onChange={(e) => setCurrentHole(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-green-500"
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
              disabled={currentHole === 18}
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">Hole {currentHole}</div>
            <div className="text-lg text-gray-600">Par {holePar}</div>
          </div>
        </div>
      </div>

      {/* Player Scoring Cards */}
      <div className="space-y-4">
        {selectedGroup.players.map(player => {
          const playerScore = scores[player.id]?.[currentHole] || 0;
          
          return (
            <div key={player.id} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{player.name}</h3>
                  <p className="text-sm text-gray-600">
                    Flight {player.flight} | Handicap {player.handicap}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => updateScore(player.id, -1)}
                  disabled={playerScore <= 1}
                  className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-8 h-8" />
                </button>

                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-900">
                    {playerScore || '-'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
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
                  className="p-4 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-save indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
          Saving...
        </div>
      )}

      {/* View Leaderboard */}
      <div className="mt-8 flex justify-center">
        <Link
          to={`/tournament/${id}/leaderboard`}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          <BarChart3 className="w-5 h-5" />
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}