import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  cart_number: number | null;
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
  name: string;
  logo_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_logo_2_url: string | null;
}

interface Props {
  tournamentId: string;
  onClose: () => void;
}

const PrintableAllPlacards: React.FC<Props> = ({ tournamentId, onClose }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('name, logo_url, sponsor_logo_url, sponsor_logo_2_url')
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
            cart_number,
            position,
            players (
              id,
              name
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
              cart_number: gp.cart_number
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

  const buildPlacardHTML = (
    players: Player[],
    group: Group,
    t: Tournament,
    isLast: boolean
  ) => {
    const isShotgun = !!group.starting_hole;
    const startInfo = isShotgun
      ? `Hole ${group.starting_hole}${group.starting_position ? ` ${group.starting_position}` : ''}`
      : group.tee_time || '';

    const playerRows = players.length > 0
      ? players.map(p => `
          <div style="background:#f9fafb;border:2px solid #9ca3af;border-radius:12px;padding:20px;text-align:center;margin-bottom:12px;">
            <p style="font-size:28px;font-weight:bold;color:#111827;margin:0;">${p.name}</p>
          </div>
        `).join('')
      : `<div style="background:#f9fafb;border:2px solid #d1d5db;border-radius:12px;padding:20px;text-align:center;">
           <p style="font-size:22px;color:#6b7280;font-style:italic;margin:0;">No players assigned</p>
         </div>`;

    const leftLogo = t.sponsor_logo_url
      ? `<img src="${t.sponsor_logo_url}" style="max-height:80px;max-width:150px;object-fit:contain;" />`
      : '<div style="width:80px;"></div>';

    const rightLogo = t.sponsor_logo_2_url
      ? `<img src="${t.sponsor_logo_2_url}" style="max-height:80px;max-width:150px;object-fit:contain;" />`
      : '<div style="width:80px;"></div>';

    const centerLogo = t.logo_url
      ? `<img src="${t.logo_url}" style="max-height:70px;object-fit:contain;display:block;margin:0 auto 8px auto;" />`
      : '';

    const pageBreak = isLast ? '' : `<div style="page-break-after:always;break-after:page;"></div>`;

    return `
      <div style="border:4px solid #16a34a;border-radius:16px;padding:24px;background:white;box-sizing:border-box;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div style="flex:1;display:flex;justify-content:center;">${leftLogo}</div>
          <div style="flex:1;text-align:center;padding:0 16px;">
            ${centerLogo}
            <div style="font-size:22px;font-weight:bold;color:#111827;">${t.name}</div>
          </div>
          <div style="flex:1;display:flex;justify-content:flex-end;">${rightLogo}</div>
        </div>
        <div style="text-align:center;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:16px;margin-bottom:20px;">
          <div style="font-size:32px;font-weight:bold;color:#111827;">${startInfo}</div>
        </div>
        <div>${playerRows}</div>
      </div>
      ${pageBreak}
    `;
  };

  const handleSaveAsPDF = () => {
    if (!tournament) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to save as PDF');
      return;
    }

    // Build one placard per cart per group
    // 2 placards per page (cart 1 and cart 2 of each group)
    const allPlacards: string[] = [];

    groups.forEach((group, groupIndex) => {
      const cart1Players = group.players.filter(p => p.cart_number === 1);
      const cart2Players = group.players.filter(p => p.cart_number === 2);
      const isLastGroup = groupIndex === groups.length - 1;

      const cart1HTML = buildPlacardHTML(cart1Players, group, tournament, false);
      const cart2HTML = buildPlacardHTML(cart2Players, group, tournament, isLastGroup);

      allPlacards.push(cart1HTML);
      allPlacards.push(cart2HTML);
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tournament.name} - All Cart Placards</title>
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
              margin: 0.4in;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${allPlacards.join('')}
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
          <p>Loading all placards...</p>
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg text-sm z-50">
        💡 A new window will open - set Destination to <strong>"Save as PDF"</strong> · Margins: <strong>None</strong>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <div className="bg-white px-4 py-2 rounded-lg shadow text-sm font-medium text-gray-700">
          {groups.length} Groups · {groups.length * 2} Placards
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

      <div className="bg-gray-100 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4">
          {groups.map(group => {
            const isShotgun = !!group.starting_hole;
            const startInfo = isShotgun
              ? `Hole ${group.starting_hole}${group.starting_position ? ` ${group.starting_position}` : ''}`
              : group.tee_time || '';
            const cart1Players = group.players.filter(p => p.cart_number === 1);
            const cart2Players = group.players.filter(p => p.cart_number === 2);

            return (
              <div key={group.id} className="mb-6">
                <div className="text-sm font-bold text-gray-500 mb-2 px-1">
                  Group {group.number} - {startInfo}
                </div>
                {[cart1Players, cart2Players].map((cartPlayers, cartIndex) => (
                  <div key={cartIndex} className="border-4 border-green-600 rounded-xl p-4 bg-white shadow mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 flex justify-center">
                        {tournament.sponsor_logo_url && (
                          <img src={tournament.sponsor_logo_url} alt="Sponsor" className="max-h-14 object-contain" />
                        )}
                      </div>
                      <div className="flex-1 text-center">
                        {tournament.logo_url && (
                          <img src={tournament.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" />
                        )}
                        <div className="text-sm font-bold">{tournament.name}</div>
                      </div>
                      <div className="flex-1 flex justify-end">
                        {tournament.sponsor_logo_2_url && (
                          <img src={tournament.sponsor_logo_2_url} alt="Sponsor" className="max-h-14 object-contain" />
                        )}
                      </div>
                    </div>
                    <div className="text-center bg-green-50 border-2 border-green-600 rounded-lg p-2 mb-3">
                      <div className="text-xl font-bold">{startInfo}</div>
                    </div>
                    <div className="space-y-2">
                      {cartPlayers.length > 0 ? (
                        cartPlayers.map(p => (
                          <div key={p.id} className="bg-gray-50 border-2 border-gray-400 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold">{p.name}</p>
                          </div>
                        ))
                      ) : (
                        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-500 italic">No players assigned</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PrintableAllPlacards;