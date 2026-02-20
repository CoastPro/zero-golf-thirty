import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  quota: number;
  handicap: number;
}

interface Group {
  id: string;
  number: number;
  starting_hole: number | null;
  starting_position: string | null;
  tee_time: string | null;
  players: Player[];
}

interface Tournament {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_logo_2_url: string | null;
  player_instructions: string | null;
  course_name: string;
  course_par: number[];
  tournament_qr_code: string | null;
}

interface Props {
  tournamentId: string;
  onClose: () => void;
}

const PrintableAllScorecards: React.FC<Props> = ({ tournamentId, onClose }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuota, setShowQuota] = useState(true);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, number, starting_hole, starting_position, tee_time')
        .eq('tournament_id', tournamentId)
        .order('number');

      if (groupsError) throw groupsError;

      if (groupsData && groupsData.length > 0) {
        const { data: groupPlayersData, error: gpError } = await supabase
          .from('group_players')
          .select(`
            group_id,
            position,
            players (
              id,
              name,
              quota,
              handicap
            )
          `)
          .in('group_id', groupsData.map(g => g.id))
          .order('position');

        if (gpError) throw gpError;

        const groupsWithPlayers = groupsData.map(group => {
          const groupPlayers = (groupPlayersData || [])
            .filter(gp => gp.group_id === group.id)
            .map((gp: any) => ({
              id: gp.players.id,
              name: gp.players.name,
              quota: gp.players.quota,
              handicap: gp.players.handicap
            }));

          return { ...group, players: groupPlayers };
        });

        setGroups(groupsWithPlayers);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <p>Loading all scorecards...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <p className="text-red-600">Error: Tournament not found</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const coursePar = tournament.course_par;
  const frontNinePar = coursePar.slice(0, 9);
  const backNinePar = coursePar.slice(9, 18);
  const frontTotal = frontNinePar.reduce((a, b) => a + b, 0);
  const backTotal = backNinePar.reduce((a, b) => a + b, 0);
  const totalPar = frontTotal + backTotal;

  const ScorecardPage: React.FC<{ group: Group }> = ({ group }) => {
    const isShotgun = !!group.starting_hole;

    return (
      <div className="scorecard-page bg-white">
        <div className="p-4 print:p-2">

          {/* Header */}
          <div className="flex items-start justify-between mb-2 pb-2 border-b-2 border-green-600">
            <div className="flex-1">
              <h1 className="text-base font-bold text-gray-900 print:text-sm">{tournament.name}</h1>
              <p className="text-xs text-gray-700">{tournament.course_name}</p>
            </div>
            <div className="text-center flex-1">
              {isShotgun ? (
                <div className="text-sm font-semibold text-gray-900">
                  Hole {group.starting_hole}
                  {group.starting_position && ` (Tee ${group.starting_position})`}
                </div>
              ) : (
                <div className="text-sm font-semibold text-gray-900">
                  {group.tee_time}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end flex-1">
              {tournament.logo_url && (
                <img src={tournament.logo_url} alt="Tournament Logo" className="h-10 print:h-8" />
              )}
            </div>
          </div>

          {/* Scorecard Table */}
          <div className="mb-2">
            <table className="w-full border-collapse border-2 border-gray-800 text-xs print:text-[9px]">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="border border-gray-800 px-1 py-0.5 text-left" style={{width: '80px'}}>Player</th>
                  <th className="border border-gray-800 px-1 py-0.5 text-center" style={{width: '22px'}}>
                    {showQuota ? 'Q' : 'H'}
                  </th>
                  {[1,2,3,4,5,6,7,8,9].map(hole => (
                    <th key={hole} className="border border-gray-800 px-0.5 py-0.5 text-center font-bold" style={{width: '26px'}}>{hole}</th>
                  ))}
                  <th className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-green-700" style={{width: '30px'}}>OUT</th>
                  {[10,11,12,13,14,15,16,17,18].map(hole => (
                    <th key={hole} className="border border-gray-800 px-0.5 py-0.5 text-center font-bold" style={{width: '26px'}}>{hole}</th>
                  ))}
                  <th className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-green-700" style={{width: '30px'}}>IN</th>
                  <th className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-green-700" style={{width: '34px'}}>TOT</th>
                </tr>
                <tr className="bg-yellow-100">
                  <td className="border border-gray-800 px-1 py-0.5 font-bold text-xs">PAR</td>
                  <td className="border border-gray-800"></td>
                  {frontNinePar.map((par, i) => (
                    <td key={i} className="border border-gray-800 px-0.5 py-0.5 text-center font-bold">{par}</td>
                  ))}
                  <td className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-yellow-200">{frontTotal}</td>
                  {backNinePar.map((par, i) => (
                    <td key={i} className="border border-gray-800 px-0.5 py-0.5 text-center font-bold">{par}</td>
                  ))}
                  <td className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-yellow-200">{backTotal}</td>
                  <td className="border border-gray-800 px-0.5 py-0.5 text-center font-bold bg-yellow-300">{totalPar}</td>
                </tr>
              </thead>
              <tbody>
                {group.players.map(player => (
                  <tr key={player.id}>
                    <td className="border border-gray-800 px-1 py-0.5 font-semibold truncate" style={{maxWidth: '80px'}}>{player.name}</td>
                    <td className="border border-gray-800 px-0.5 py-0.5 text-center">
                      {showQuota ? player.quota : player.handicap}
                    </td>
                    {[...Array(9)].map((_, i) => (
                      <td key={i} className="border border-gray-800" style={{height: '28px'}}></td>
                    ))}
                    <td className="border border-gray-800 bg-gray-100"></td>
                    {[...Array(9)].map((_, i) => (
                      <td key={`back-${i}`} className="border border-gray-800" style={{height: '28px'}}></td>
                    ))}
                    <td className="border border-gray-800 bg-gray-100"></td>
                    <td className="border border-gray-800 bg-gray-200"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Instructions */}
          {tournament.player_instructions && (
            <div className="mb-2 text-center">
              <p className="text-xs text-gray-700">
                {tournament.player_instructions}
              </p>
            </div>
          )}

          {/* Bottom: Sponsors + QR */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex justify-center items-center" style={{height: '70px'}}>
              {tournament.sponsor_logo_url ? (
                <img src={tournament.sponsor_logo_url} alt="Sponsor" className="max-h-16 max-w-full object-contain" />
              ) : (
                <div className="text-xs text-gray-400">Sponsor Logo</div>
              )}
            </div>
            <div className="text-center flex flex-col items-center justify-center" style={{width: '110px'}}>
              {tournament.tournament_qr_code ? (
                <>
                  <p className="text-xs font-semibold mb-0.5">Scan to Score</p>
                  <img src={tournament.tournament_qr_code} alt="Scoring QR Code" className="w-16 h-16" />
                </>
              ) : (
                <div className="w-16 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-400 text-center">No QR Code</span>
                </div>
              )}
            </div>
            <div className="flex-1 flex justify-center items-center" style={{height: '70px'}}>
              {tournament.sponsor_logo_2_url ? (
                <img src={tournament.sponsor_logo_2_url} alt="Sponsor" className="max-h-16 max-w-full object-contain" />
              ) : (
                <div className="text-xs text-gray-400">Sponsor Logo</div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      {/* Tip Banner */}
      <div className="print:hidden absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg text-sm z-50">
        💡 When dialog opens, set Destination to <strong>"Save as PDF"</strong> · Orientation: <strong>Portrait</strong> · Margins: <strong>None</strong>
      </div>

      {/* Screen Controls */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
        <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
          <input
            type="checkbox"
            checked={showQuota}
            onChange={(e) => setShowQuota(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">Show {showQuota ? 'Quota' : 'Handicap'}</span>
        </label>
        <div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-medium text-gray-700">
          {groups.length} Scorecards · {Math.ceil(groups.length / 2)} Pages
        </div>
        <button
          onClick={handleSaveAsPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save All as PDF
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* All Scorecards - 2 per page preview on screen */}
      <div className="bg-gray-100 w-full max-w-4xl max-h-[90vh] overflow-auto print:max-h-none print:overflow-visible print:bg-white">
        {groups.map((group, index) => (
          <div key={group.id}>
            <ScorecardPage group={group} />
            {index < groups.length - 1 && (
              <div className="print:hidden border-t-4 border-dashed border-gray-400 my-1 mx-6" />
            )}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .scorecard-page, .scorecard-page * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          .scorecard-page {
            page-break-inside: avoid;
            break-inside: avoid;
            height: 49%;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
          }
          .scorecard-page:nth-child(even) {
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: letter portrait;
            margin: 0.2in 0.3in;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintableAllScorecards;