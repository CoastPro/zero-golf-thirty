import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  handicap: number;
  quota: number;
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
  course_name: string | null;
  logo_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_logo_2_url: string | null;
}

interface Props {
  tournamentId: string;
  onClose: () => void;
}

const PrintableGroupings: React.FC<Props> = ({ tournamentId, onClose }) => {
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
        .select('id, name, course_name, logo_url, sponsor_logo_url, sponsor_logo_2_url')
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
              handicap,
              quota
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
              handicap: gp.players.handicap,
              quota: gp.players.quota
            }));
          return { ...group, players: groupPlayers };
        });

        // Sort by starting hole or tee time
        groupsWithPlayers.sort((a, b) => {
          if (a.starting_hole && b.starting_hole) {
            if (a.starting_hole !== b.starting_hole) {
              return a.starting_hole - b.starting_hole;
            }
            return (a.starting_position || '').localeCompare(b.starting_position || '');
          }
          if (a.tee_time && b.tee_time) {
            return a.tee_time.localeCompare(b.tee_time);
          }
          return a.number - b.number;
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

  const getStartInfo = (group: Group) => {
    if (group.starting_hole) {
      return `Hole ${group.starting_hole}${group.starting_position ? group.starting_position : ''}`;
    }
    if (group.tee_time) return group.tee_time;
    return '-';
  };

  const getPlayerDisplay = (player: Player) => {
    const value = showQuota ? player.quota : player.handicap;
    return `${player.name} (${value})`;
  };

  const handleSaveAsPDF = () => {
    if (!tournament) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to save as PDF');
      return;
    }

    const leftLogo = tournament.sponsor_logo_url
      ? `<img src="${tournament.sponsor_logo_url}" style="max-height:70px;max-width:180px;object-fit:contain;" />`
      : '';

    const rightLogo = tournament.sponsor_logo_2_url
      ? `<img src="${tournament.sponsor_logo_2_url}" style="max-height:70px;max-width:180px;object-fit:contain;" />`
      : '';

    const centerLogo = tournament.logo_url
      ? `<img src="${tournament.logo_url}" style="max-height:60px;object-fit:contain;display:block;margin:0 auto 6px auto;" />`
      : '';

    const tableRows = groups.map(group => {
      const startInfo = getStartInfo(group);
      const playerList = group.players.length > 0
        ? group.players.map(p => {
            const value = showQuota ? p.quota : p.handicap;
            return `${p.name} (${value})`;
          }).join('&nbsp;&nbsp;|&nbsp;&nbsp;')
        : '<span style="color:#6b7280;font-style:italic;">No players assigned</span>';

      return `
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-weight:bold;font-size:13px;white-space:nowrap;background:#f9fafb;text-align:center;">${startInfo}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;">${playerList}</td>
        </tr>
      `;
    }).join('');

    const isShotgun = groups.some(g => g.starting_hole);
    const columnHeader = isShotgun ? 'Hole' : 'Tee Time';
    const valueLabel = showQuota ? 'Quota' : 'Handicap';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tournament.name} - Groupings</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              background: white;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            @page {
              size: letter landscape;
              margin: 0.3in 0.4in;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #16a34a;">
            <div style="flex:1;display:flex;justify-content:flex-start;align-items:center;">
              ${leftLogo}
            </div>
            <div style="flex:2;text-align:center;">
              ${centerLogo}
              <div style="font-size:22px;font-weight:bold;color:#111827;">${tournament.name}</div>
              ${tournament.course_name ? `<div style="font-size:14px;color:#374151;margin-top:2px;">${tournament.course_name}</div>` : ''}
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Groupings · ${valueLabel} shown in parentheses</div>
            </div>
            <div style="flex:1;display:flex;justify-content:flex-end;align-items:center;">
              ${rightLogo}
            </div>
          </div>

          <!-- Table -->
          <table style="width:100%;border-collapse:collapse;border:2px solid #1f2937;">
            <thead>
              <tr style="background:#16a34a;color:white;">
                <th style="border:1px solid #15803d;padding:8px 12px;font-size:13px;width:100px;text-align:center;">${columnHeader}</th>
                <th style="border:1px solid #15803d;padding:8px 12px;font-size:13px;text-align:left;">Players</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1500);
    };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <p>Loading groupings...</p>
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const isShotgun = groups.some(g => g.starting_hole);
  const columnHeader = isShotgun ? 'Hole' : 'Tee Time';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg text-sm z-50">
        💡 A new window will open - set Destination to <strong>"Save as PDF"</strong> · Orientation: <strong>Landscape</strong> · Margins: <strong>None</strong>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
          <input
            type="checkbox"
            checked={showQuota}
            onChange={(e) => setShowQuota(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">
            Show {showQuota ? 'Quota' : 'Handicap'}
          </span>
        </label>
        <button
          onClick={handleSaveAsPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save as PDF
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
      <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-auto rounded-lg shadow-xl">
        <div className="p-6">

          {/* Preview Header */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-green-600">
            <div className="flex-1 flex justify-start">
              {tournament.sponsor_logo_url && (
                <img src={tournament.sponsor_logo_url} alt="Sponsor" className="max-h-16 object-contain" />
              )}
            </div>
            <div className="flex-2 text-center">
              {tournament.logo_url && (
                <img src={tournament.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" />
              )}
              <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
              {tournament.course_name && (
                <p className="text-sm text-gray-600">{tournament.course_name}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Groupings · {showQuota ? 'Quota' : 'Handicap'} shown in parentheses
              </p>
            </div>
            <div className="flex-1 flex justify-end">
              {tournament.sponsor_logo_2_url && (
                <img src={tournament.sponsor_logo_2_url} alt="Sponsor" className="max-h-16 object-contain" />
              )}
            </div>
          </div>

          {/* Preview Table */}
          <table className="w-full border-collapse border-2 border-gray-800 text-sm">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="border border-gray-800 px-3 py-2 text-center font-semibold" style={{width: '100px'}}>
                  {columnHeader}
                </th>
                <th className="border border-gray-800 px-3 py-2 text-left font-semibold">
                  Players
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={group.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-3 py-2 font-bold text-center whitespace-nowrap">
                    {getStartInfo(group)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {group.players.length > 0 ? (
                      <span>
                        {group.players.map((player, i) => (
                          <span key={player.id}>
                            {getPlayerDisplay(player)}
                            {i < group.players.length - 1 && (
                              <span className="text-gray-400 mx-2">|</span>
                            )}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No players assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
};

export default PrintableGroupings;