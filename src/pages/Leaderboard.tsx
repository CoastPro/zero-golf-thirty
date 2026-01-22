import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, Trophy, Edit, Settings, Eye, EyeOff, ChevronUp, ChevronDown, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Score, Tournament } from '../types/database.types';
import { buildLeaderboard, buildSkinsLeaderboard, formatVsPar, formatHolesPlayed } from '../lib/calculations';

type LeaderboardTab = 'gross' | 'stableford' | 'skins';

export default function Leaderboard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const groupIdParam = searchParams.get('group');
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsOrder, setSettingsOrder] = useState<LeaderboardTab[]>(['gross', 'stableford', 'skins']);
  const [settingsHidden, setSettingsHidden] = useState<LeaderboardTab[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { loadData(); }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, id]);

  useEffect(() => {
    const channel = supabase.channel('score-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => { loadData(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase.from('tournaments').select('*').eq('id', id).single();
      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: playersData, error: playersError } = await supabase.from('players').select('*').eq('tournament_id', id).order('name');
      if (playersError) throw playersError;
      setPlayers(playersData || []);

      if (playersData && playersData.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase.from('scores').select('*').in('player_id', playersData.map(p => p.id));
        if (scoresError) throw scoresError;
        setScores(scoresData || []);
      }

      if (tournamentData.leaderboard_settings) {
        const order = tournamentData.leaderboard_settings.tabs || ['gross', 'stableford', 'skins'];
        const hidden = tournamentData.leaderboard_settings.hidden || [];
        setSettingsOrder(order);
        setSettingsHidden(hidden);
        
        const visibleTabs = order.filter((tab: LeaderboardTab) => !hidden.includes(tab));
        if (visibleTabs.length > 0 && activeTab === null) {
          setActiveTab(visibleTabs[0]);
        }
      } else if (activeTab === null) {
        setActiveTab('gross');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLeaderboardSettings = async () => {
    try {
      setSavingSettings(true);
      
      const { error } = await supabase
        .from('tournaments')
        .update({
          leaderboard_settings: {
            tabs: settingsOrder,
            hidden: settingsHidden
          }
        })
        .eq('id', id);

      if (error) throw error;

      if (tournament) {
        setTournament({
          ...tournament,
          leaderboard_settings: {
            tabs: settingsOrder,
            hidden: settingsHidden
          }
        });
      }

      if (settingsHidden.includes(activeTab!)) {
        const visibleTabs = settingsOrder.filter(tab => !settingsHidden.includes(tab));
        if (visibleTabs.length > 0) {
          setActiveTab(visibleTabs[0]);
        }
      }

      setShowSettings(false);
      alert('Leaderboard settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleTabVisibility = (tab: LeaderboardTab) => {
    if (settingsHidden.includes(tab)) {
      setSettingsHidden(settingsHidden.filter(t => t !== tab));
    } else {
      setSettingsHidden([...settingsHidden, tab]);
    }
  };

  const moveTabUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...settingsOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSettingsOrder(newOrder);
  };

  const moveTabDown = (index: number) => {
    if (index === settingsOrder.length - 1) return;
    const newOrder = [...settingsOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSettingsOrder(newOrder);
  };

  if (loading) return <div className="text-center py-12">Loading leaderboard...</div>;
  if (!tournament || activeTab === null) return <div className="text-center py-12">Tournament not found</div>;

  const leaderboard = buildLeaderboard(players, scores, tournament, selectedFlight);
  const showNet = tournament.format === 'net' || tournament.format === 'both';
  const tabOrder: LeaderboardTab[] = tournament.leaderboard_settings?.tabs || ['gross', 'stableford', 'skins'];
  const hiddenTabs: LeaderboardTab[] = tournament.leaderboard_settings?.hidden || [];
  const visibleTabs = tabOrder.filter(tab => !hiddenTabs.includes(tab));
  const skinsData = tournament.skins_enabled ? buildSkinsLeaderboard(players, scores, tournament) : null;

  // Build score link with group parameter if it exists
  const scoreLink = groupIdParam 
    ? `/tournament/${id}/score?group=${groupIdParam}`
    : `/tournament/${id}/score`;

  const getTabLabel = (tab: LeaderboardTab): string => {
    if (tab === 'gross') return showNet ? 'Gross / Net' : tournament.format === 'net' ? 'Net' : 'Gross';
    if (tab === 'stableford') return 'Stableford';
    return 'Skins';
  };

  return (
    <div className="px-2 py-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{tournament.name}</h2>
          {tournament.course_name && <p className="text-sm text-gray-600">{tournament.course_name}</p>}
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 px-2 py-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded text-xs transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${autoRefresh ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live' : 'Off'}
          </button>
          <Link to={scoreLink} className="flex items-center gap-1 px-2 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded text-xs transition-colors">
            <Edit className="w-4 h-4" />
            Score
          </Link>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-lg p-4 mb-3 border-2 border-gray-300">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Leaderboard Settings</h3>
          <p className="text-xs text-gray-600 mb-3">
            Reorder and show/hide leaderboard tabs. Changes apply to all viewers.
          </p>

          <div className="space-y-2 mb-4">
            {settingsOrder.map((tab, index) => (
              <div key={tab} className="flex items-center justify-between bg-gray-50 p-2 rounded border-2 border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveTabUp(index)}
                      disabled={index === 0}
                      className="p-0.5 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveTabDown(index)}
                      disabled={index === settingsOrder.length - 1}
                      className="p-0.5 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="font-semibold text-sm text-gray-900">{getTabLabel(tab)}</div>
                </div>

                <button
                  onClick={() => toggleTabVisibility(tab)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    settingsHidden.includes(tab)
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {settingsHidden.includes(tab) ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      Hidden
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      Visible
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveLeaderboardSettings}
              disabled={savingSettings}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {activeTab !== 'skins' && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          <button onClick={() => setSelectedFlight(null)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${selectedFlight === null ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>All</button>
          {tournament.flights.map(flight => (
            <button key={flight} onClick={() => setSelectedFlight(flight)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${selectedFlight === flight ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Flt {flight}</button>
          ))}
        </div>
      )}

      {activeTab === 'gross' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Pos</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Player</th>
                  {tournament.show_handicaps && <th className="px-1.5 py-1.5 text-center font-semibold">HC</th>}
                  <th className="px-1.5 py-1.5 text-center font-semibold">Thru</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold">Gross</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold">±</th>
                  {showNet && (<><th className="px-1.5 py-1.5 text-center font-semibold">Net</th><th className="px-1.5 py-1.5 text-center font-semibold">±</th></>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((entry, index) => {
                  const isLeader = index === 0 && entry.holesPlayed > 0;
                  return (
                    <tr key={entry.player.id} className={`hover:bg-gray-50 ${isLeader ? 'bg-yellow-50' : ''}`}>
                      <td className="px-1.5 py-1.5 font-semibold">{entry.holesPlayed === 0 ? '-' : index + 1}{isLeader && <Trophy className="w-3 h-3 inline ml-0.5 text-yellow-600" />}</td>
                      <td className="px-1.5 py-1.5 font-medium truncate max-w-[100px]">{entry.player.name}</td>
                      {tournament.show_handicaps && <td className="px-1.5 py-1.5 text-center">{entry.player.handicap}</td>}
                      <td className="px-1.5 py-1.5 text-center font-medium">{formatHolesPlayed(entry.holesPlayed)}</td>
                      <td className="px-1.5 py-1.5 text-center font-bold">{entry.holesPlayed > 0 ? entry.grossScore : '-'}</td>
                      <td className="px-1.5 py-1.5 text-center font-semibold">{entry.holesPlayed > 0 ? formatVsPar(entry.vsParGross) : '-'}</td>
                      {showNet && (<><td className="px-1.5 py-1.5 text-center font-bold">{entry.netScore !== null ? entry.netScore : '-'}</td><td className="px-1.5 py-1.5 text-center font-semibold">{entry.vsParNet !== null ? formatVsPar(entry.vsParNet) : '-'}</td></>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showNet && <div className="bg-gray-50 px-2 py-1.5 text-xs text-gray-600 border-t">* Net scores after 18 holes</div>}
        </div>
      )}

      {activeTab === 'stableford' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Pos</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Player</th>
                  {tournament.show_quotas && <th className="px-1.5 py-1.5 text-center font-semibold">Quota</th>}
                  <th className="px-1.5 py-1.5 text-center font-semibold">Thru</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold">Pts</th>
                  <th className="px-1.5 py-1.5 text-center font-semibold">vs Q</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard
                  .sort((a, b) => {
                    if (b.vsQuota !== a.vsQuota) {
                      return b.vsQuota - a.vsQuota;
                    }
                    return b.stablefordPoints - a.stablefordPoints;
                  })
                  .map((entry, index) => {
                    const isLeader = index === 0 && entry.holesPlayed > 0;
                    const vsQuotaDisplay = entry.isComplete ? entry.vsQuota.toFixed(0) : entry.vsQuota.toFixed(1);
                    return (
                      <tr key={entry.player.id} className={`hover:bg-gray-50 ${isLeader ? 'bg-yellow-50' : ''}`}>
                        <td className="px-1.5 py-1.5 font-semibold">{entry.holesPlayed === 0 ? '-' : index + 1}{isLeader && <Trophy className="w-3 h-3 inline ml-0.5 text-yellow-600" />}</td>
                        <td className="px-1.5 py-1.5 font-medium truncate max-w-[100px]">{entry.player.name}</td>
                        {tournament.show_quotas && <td className="px-1.5 py-1.5 text-center">{entry.player.quota}</td>}
                        <td className="px-1.5 py-1.5 text-center font-medium">{formatHolesPlayed(entry.holesPlayed)}</td>
                        <td className="px-1.5 py-1.5 text-center font-bold">{entry.holesPlayed > 0 ? entry.stablefordPoints : '-'}</td>
                        <td className="px-1.5 py-1.5 text-center font-semibold">{entry.holesPlayed > 0 ? `${entry.vsQuota > 0 ? '+' : ''}${vsQuotaDisplay}` : '-'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-2 py-1.5 text-xs text-gray-600 border-t">* Prorated during play, final vs full quota when complete</div>
        </div>
      )}

      {activeTab === 'skins' && skinsData && (
        <div>
          <div className="bg-white rounded-lg shadow p-3 mb-3">
            <h3 className="text-base font-bold text-gray-900 mb-2">Skins Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="text-center p-2 bg-green-50 rounded"><div className="text-lg font-bold text-green-600">${skinsData.totalPot.toFixed(2)}</div><div className="text-xs text-gray-600">Total Pot</div></div>
              <div className="text-center p-2 bg-blue-50 rounded"><div className="text-lg font-bold text-blue-600">{skinsData.skinsWon}</div><div className="text-xs text-gray-600">Skins Won</div></div>
              <div className="text-center p-2 bg-yellow-50 rounded"><div className="text-lg font-bold text-yellow-600">${skinsData.valuePerSkin.toFixed(2)}</div><div className="text-xs text-gray-600">Per Skin</div></div>
              <div className="text-center p-2 bg-purple-50 rounded"><div className="text-lg font-bold text-purple-600">{tournament.skins_type.toUpperCase()}</div><div className="text-xs text-gray-600">Type</div></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-green-600 text-white">
                  <tr>
                    <th className="px-1.5 py-1.5 text-left font-semibold">Pos</th>
                    <th className="px-1.5 py-1.5 text-left font-semibold">Player</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Skins</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Holes</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Winnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {skinsData.leaderboard.length === 0 ? (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-600">No skins won yet</td></tr>
                  ) : (
                    skinsData.leaderboard.map((entry, index) => {
                      const isLeader = index === 0;
                      return (
                        <tr key={entry.player.id} className={`hover:bg-gray-50 ${isLeader ? 'bg-yellow-50' : ''}`}>
                          <td className="px-1.5 py-1.5 font-semibold">{index + 1}{isLeader && <Trophy className="w-3 h-3 inline ml-0.5 text-yellow-600" />}</td>
                          <td className="px-1.5 py-1.5 font-medium truncate max-w-[100px]">{entry.player.name}</td>
                          <td className="px-1.5 py-1.5 text-center font-bold text-green-600">{entry.skins}</td>
                          <td className="px-1.5 py-1.5 text-center">{entry.holes.sort((a, b) => a - b).join(', ')}</td>
                          <td className="px-1.5 py-1.5 text-center font-bold text-green-600">${entry.winnings.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {skinsData.winners.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 mt-3">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Hole-by-Hole Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {skinsData.winners.map(winner => (
                  <div key={`${winner.hole}-${winner.playerId}`} className="border rounded p-2">
                    <div className="text-xs text-gray-600 mb-0.5">Hole {winner.hole}</div>
                    <div className="font-semibold text-xs truncate">{winner.playerName}</div>
                    <div className="text-xs text-gray-600">Score: {winner.score}</div>
                    {winner.skinsWon > 1 && <div className="text-xs font-bold text-green-600">{winner.skinsWon} Skins!</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {leaderboard.length === 0 && activeTab !== 'skins' && (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-600 text-sm mb-2">No players in this tournament yet</p>
          <Link to={`/admin/tournament/${id}/players`} className="text-green-600 hover:text-green-700 font-semibold text-sm">Add players to get started</Link>
        </div>
      )}
    </div>
  );
}