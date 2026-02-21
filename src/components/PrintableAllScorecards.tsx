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

  const buildScorecardHTML = (group: Group, t: Tournament, useQuota: boolean) => {
    const coursePar = t.course_par;
    const frontNinePar = coursePar.slice(0, 9);
    const backNinePar = coursePar.slice(9, 18);
    const frontTotal = frontNinePar.reduce((a, b) => a + b, 0);
    const backTotal = backNinePar.reduce((a, b) => a + b, 0);
    const totalPar = frontTotal + backTotal;
    const isShotgun = !!group.starting_hole;

    const startInfo = isShotgun
      ? `Hole ${group.starting_hole}${group.starting_position ? ` (Tee ${group.starting_position})` : ''}`
      : group.tee_time || '';

    const frontHeaders = frontNinePar.map((_, i) =>
      `<th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:28px;font-size:10px;">${i + 1}</th>`
    ).join('');

    const backHeaders = backNinePar.map((_, i) =>
      `<th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:28px;font-size:10px;">${i + 10}</th>`
    ).join('');

    const frontParCells = frontNinePar.map(par =>
      `<td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;background:#fef9c3;font-weight:bold;font-size:10px;">${par}</td>`
    ).join('');

    const backParCells = backNinePar.map(par =>
      `<td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;background:#fef9c3;font-weight:bold;font-size:10px;">${par}</td>`
    ).join('');

    const playerRows = group.players.map(player => {
      const frontCells = Array(9).fill(0).map(() =>
        `<td style="border:1px solid #1f2937;padding:0;height:28px;"></td>`
      ).join('');
      const backCells = Array(9).fill(0).map(() =>
        `<td style="border:1px solid #1f2937;padding:0;height:28px;"></td>`
      ).join('');

      return `
        <tr>
          <td style="border:1px solid #1f2937;padding:2px 4px;font-weight:600;font-size:10px;max-width:80px;overflow:hidden;white-space:nowrap;">${player.name}</td>
          <td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;font-size:10px;">${useQuota ? player.quota : player.handicap}</td>
          ${frontCells}
          <td style="border:1px solid #1f2937;padding:2px;background:#f3f4f6;"></td>
          ${backCells}
          <td style="border:1px solid #1f2937;padding:2px;background:#f3f4f6;"></td>
          <td style="border:1px solid #1f2937;padding:2px;background:#e5e7eb;"></td>
        </tr>
      `;
    }).join('');

    const qrSection = t.tournament_qr_code
      ? `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;">
           <p style="font-size:10px;font-weight:600;margin:0 0 2px 0;">Scan to Score</p>
           <img src="${t.tournament_qr_code}" style="width:80px;height:80px;" />
         </div>`
      : `<div style="width:80px;height:80px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;">
           <span style="font-size:9px;color:#9ca3af;text-align:center;">No QR Code</span>
         </div>`;

    const leftLogo = t.sponsor_logo_url
      ? `<img src="${t.sponsor_logo_url}" style="max-height:70px;max-width:100%;object-fit:contain;" />`
      : `<span style="font-size:10px;color:#9ca3af;">Sponsor Logo</span>`;

    const rightLogo = t.sponsor_logo_2_url
      ? `<img src="${t.sponsor_logo_2_url}" style="max-height:70px;max-width:100%;object-fit:contain;" />`
      : `<span style="font-size:10px;color:#9ca3af;">Sponsor Logo</span>`;

    const tournamentLogo = t.logo_url
      ? `<img src="${t.logo_url}" style="height:48px;object-fit:contain;" />`
      : '';

    const instructions = t.player_instructions
      ? `<div style="text-align:center;margin-bottom:6px;">
           <p style="font-size:10px;color:#374151;margin:0;">${t.player_instructions}</p>
         </div>`
      : '';

    return `
      <div style="padding:12px 16px;background:white;box-sizing:border-box;height:49%;overflow:hidden;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid #16a34a;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:bold;color:#111827;">${t.name}</div>
            <div style="font-size:11px;color:#374151;">${t.course_name || ''}</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="font-size:12px;font-weight:600;color:#111827;">${startInfo}</div>
          </div>
          <div style="flex:1;display:flex;justify-content:flex-end;align-items:center;">
            ${tournamentLogo}
          </div>
        </div>

        <!-- Scorecard Table -->
        <div style="margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;border:2px solid #1f2937;">
            <thead>
              <tr style="background:#16a34a;color:white;">
                <th style="border:1px solid #1f2937;padding:2px 4px;text-align:left;width:80px;font-size:10px;">Player</th>
                <th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:22px;font-size:10px;">${useQuota ? 'Q' : 'H'}</th>
                ${frontHeaders}
                <th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:30px;font-size:10px;background:#15803d;">OUT</th>
                ${backHeaders}
                <th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:30px;font-size:10px;background:#15803d;">IN</th>
                <th style="border:1px solid #1f2937;padding:2px 1px;text-align:center;width:34px;font-size:10px;background:#15803d;">TOT</th>
              </tr>
              <tr style="background:#fef9c3;">
                <td style="border:1px solid #1f2937;padding:2px 4px;font-weight:bold;font-size:10px;">PAR</td>
                <td style="border:1px solid #1f2937;"></td>
                ${frontParCells}
                <td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;font-weight:bold;font-size:10px;background:#fef08a;">${frontTotal}</td>
                ${backParCells}
                <td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;font-weight:bold;font-size:10px;background:#fef08a;">${backTotal}</td>
                <td style="border:1px solid #1f2937;padding:2px 1px;text-align:center;font-weight:bold;font-size:10px;background:#fde047;">${totalPar}</td>
              </tr>
            </thead>
            <tbody>
              ${playerRows}
            </tbody>
          </table>
        </div>

        ${instructions}

        <!-- Bottom: Sponsors + QR -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
          <div style="flex:1;display:flex;justify-content:center;align-items:center;height:80px;">
            ${leftLogo}
          </div>
          <div style="width:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            ${qrSection}
          </div>
          <div style="flex:1;display:flex;justify-content:center;align-items:center;height:80px;">
            ${rightLogo}
          </div>
        </div>

      </div>
    `;
  };

  const handleSaveAsPDF = () => {
    if (!tournament) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to save as PDF');
      return;
    }

    const allScorecardsHTML = groups.map((group, index) => {
      const card = buildScorecardHTML(group, tournament, showQuota);
      const pageBreak = (index % 2 === 1 && index < groups.length - 1)
        ? `<div style="page-break-after:always;"></div>`
        : '';
      return card + pageBreak;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tournament.name} - All Scorecards</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              background: white;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            @page {
              size: letter portrait;
              margin: 0.2in 0.3in;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${allScorecardsHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1000);
    };
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      {/* Tip Banner */}
      <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg text-sm z-50">
        💡 A new window will open - set Destination to <strong>"Save as PDF"</strong> · Margins: <strong>None</strong>
      </div>

      {/* Screen Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
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

      {/* Screen Preview */}
      <div className="bg-gray-100 w-full max-w-4xl max-h-[90vh] overflow-auto">
        {groups.map((group, index) => {
          const isShotgun = !!group.starting_hole;
          const startInfo = isShotgun
            ? `Hole ${group.starting_hole}${group.starting_position ? ` (Tee ${group.starting_position})` : ''}`
            : group.tee_time || '';

          return (
            <div key={group.id} className="bg-white mx-4 my-2 p-4 rounded-lg shadow">
              {/* Preview Header */}
              <div className="flex items-start justify-between mb-2 pb-2 border-b-2 border-green-600">
                <div className="flex-1">
                  <h1 className="text-base font-bold text-gray-900">{tournament.name}</h1>
                  <p className="text-xs text-gray-700">{tournament.course_name}</p>
                </div>
                <div className="text-center flex-1">
                  <div className="text-sm font-semibold text-gray-900">{startInfo}</div>
                </div>
                <div className="flex items-center justify-end flex-1">
                  {tournament.logo_url && (
                    <img src={tournament.logo_url} alt="Logo" className="h-10" />
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="mb-2 overflow-x-auto">
                <table className="w-full border-collapse border-2 border-gray-800 text-xs">
                  <thead>
                    <tr className="bg-green-600 text-white">
                      <th className="border border-gray-800 px-1 py-0.5 text-left" style={{width: '80px'}}>Player</th>
                      <th className="border border-gray-800 px-1 py-0.5 text-center" style={{width: '22px'}}>{showQuota ? 'Q' : 'H'}</th>
                      {[1,2,3,4,5,6,7,8,9].map(h => (
                        <th key={h} className="border border-gray-800 px-0.5 py-0.5 text-center" style={{width: '26px'}}>{h}</th>
                      ))}
                      <th className="border border-gray-800 px-0.5 py-0.5 text-center bg-green-700" style={{width: '30px'}}>OUT</th>
                      {[10,11,12,13,14,15,16,17,18].map(h => (
                        <th key={h} className="border border-gray-800 px-0.5 py-0.5 text-center" style={{width: '26px'}}>{h}</th>
                      ))}
                      <th className="border border-gray-800 px-0.5 py-0.5 text-center bg-green-700" style={{width: '30px'}}>IN</th>
                      <th className="border border-gray-800 px-0.5 py-0.5 text-center bg-green-700" style={{width: '34px'}}>TOT</th>
                    </tr>
                    <tr className="bg-yellow-100">
                      <td className="border border-gray-800 px-1 py-0.5 font-bold">PAR</td>
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
                        <td className="border border-gray-800 px-0.5 py-0.5 text-center">{showQuota ? player.quota : player.handicap}</td>
                        {[...Array(9)].map((_, i) => (
                          <td key={i} className="border border-gray-800" style={{height: '26px'}}></td>
                        ))}
                        <td className="border border-gray-800 bg-gray-100"></td>
                        {[...Array(9)].map((_, i) => (
                          <td key={`b-${i}`} className="border border-gray-800" style={{height: '26px'}}></td>
                        ))}
                        <td className="border border-gray-800 bg-gray-100"></td>
                        <td className="border border-gray-800 bg-gray-200"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Preview Bottom */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex justify-center" style={{height: '70px'}}>
                  {tournament.sponsor_logo_url
                    ? <img src={tournament.sponsor_logo_url} alt="Sponsor" className="max-h-16 object-contain" />
                    : <span className="text-xs text-gray-400">Sponsor Logo</span>}
                </div>
                <div className="flex flex-col items-center" style={{width: '110px'}}>
                  {tournament.tournament_qr_code ? (
                    <>
                      <p className="text-xs font-semibold mb-0.5">Scan to Score</p>
                      <img src={tournament.tournament_qr_code} alt="QR" className="w-16 h-16" />
                    </>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-400">No QR</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex justify-center" style={{height: '70px'}}>
                  {tournament.sponsor_logo_2_url
                    ? <img src={tournament.sponsor_logo_2_url} alt="Sponsor" className="max-h-16 object-contain" />
                    : <span className="text-xs text-gray-400">Sponsor Logo</span>}
                </div>
              </div>

              {index % 2 === 0 && index < groups.length - 1 && (
                <div className="border-t-4 border-dashed border-gray-400 mt-2 -mx-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrintableAllScorecards;