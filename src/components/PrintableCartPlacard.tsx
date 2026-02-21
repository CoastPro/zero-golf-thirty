import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

interface PrintableCartPlacardProps {
  groupId: string;
  onClose: () => void;
}

const PrintableCartPlacard: React.FC<PrintableCartPlacardProps> = ({ groupId, onClose }) => {
  const { id: tournamentId } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('name, logo_url, sponsor_logo_url, sponsor_logo_2_url')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, number, starting_hole, starting_position, tee_time')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const { data: groupPlayersData, error: gpError } = await supabase
        .from('group_players')
        .select(`
          cart_number,
          position,
          players (
            id,
            name
          )
        `)
        .eq('group_id', groupId)
        .order('position');

      if (gpError) throw gpError;

      const players = (groupPlayersData || []).map((gp: any) => ({
        id: gp.players.id,
        name: gp.players.name,
        cart_number: gp.cart_number
      }));

      setGroup({ ...groupData, players });

    } catch (error: any) {
      console.error('Error loading placard data:', error);
      alert(`Failed to load placard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const buildPlacardHTML = (
    cartNumber: number,
    players: Player[],
    group: Group,
    tournament: Tournament,
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

    const leftLogo = tournament.sponsor_logo_url
      ? `<img src="${tournament.sponsor_logo_url}" style="max-height:80px;max-width:150px;object-fit:contain;" />`
      : '<div style="width:80px;"></div>';

    const rightLogo = tournament.sponsor_logo_2_url
      ? `<img src="${tournament.sponsor_logo_2_url}" style="max-height:80px;max-width:150px;object-fit:contain;" />`
      : '<div style="width:80px;"></div>';

    const centerLogo = tournament.logo_url
      ? `<img src="${tournament.logo_url}" style="max-height:70px;object-fit:contain;display:block;margin:0 auto 8px auto;" />`
      : '';

    const pageBreak = isLast ? '' : `<div style="page-break-after:always;break-after:page;"></div>`;

    return `
      <div style="border:4px solid #16a34a;border-radius:16px;padding:24px;background:white;box-sizing:border-box;margin-bottom:16px;">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div style="flex:1;display:flex;justify-content:center;">${leftLogo}</div>
          <div style="flex:1;text-align:center;padding:0 16px;">
            ${centerLogo}
            <div style="font-size:22px;font-weight:bold;color:#111827;">${tournament.name}</div>
          </div>
          <div style="flex:1;display:flex;justify-content:flex-end;">${rightLogo}</div>
        </div>

        <div style="text-align:center;background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:16px;margin-bottom:20px;">
          <div style="font-size:32px;font-weight:bold;color:#111827;">${startInfo}</div>
        </div>

        <div>
          ${playerRows}
        </div>

      </div>
      ${pageBreak}
    `;
  };

  const handleSaveAsPDF = () => {
    if (!group || !tournament) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to save as PDF');
      return;
    }

    const cart1Players = group.players.filter(p => p.cart_number === 1);
    const cart2Players = group.players.filter(p => p.cart_number === 2);

    const cart1HTML = buildPlacardHTML(1, cart1Players, group, tournament, false);
    const cart2HTML = buildPlacardHTML(2, cart2Players, group, tournament, true);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tournament.name} - Cart Placards</title>
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
          ${cart1HTML}
          ${cart2HTML}
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
          <p>Loading placards...</p>
        </div>
      </div>
    );
  }

  if (!group || !tournament) return null;

  const cart1Players = group.players.filter(p => p.cart_number === 1);
  const cart2Players = group.players.filter(p => p.cart_number === 2);
  const isShotgun = !!group.starting_hole;
  const startInfo = isShotgun
    ? `Hole ${group.starting_hole}${group.starting_position ? ` ${group.starting_position}` : ''}`
    : group.tee_time || '';

  const PlacardCard = ({ players }: { players: Player[] }) => (
    <div className="border-4 border-green-600 rounded-xl p-6 bg-white shadow-lg mb-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex-1 flex justify-center">
          {tournament.sponsor_logo_url
            ? <img src={tournament.sponsor_logo_url} alt="Sponsor" className="max-h-20 max-w-full object-contain" />
            : <div className="w-20 h-20" />}
        </div>
        <div className="flex-1 text-center px-4">
          {tournament.logo_url && (
            <img src={tournament.logo_url} alt="Logo" className="h-16 mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
        </div>
        <div className="flex-1 flex justify-center">
          {tournament.sponsor_logo_2_url
            ? <img src={tournament.sponsor_logo_2_url} alt="Sponsor" className="max-h-20 max-w-full object-contain" />
            : <div className="w-20 h-20" />}
        </div>
      </div>

      <div className="text-center bg-green-50 border-2 border-green-600 rounded-xl p-4 mb-5">
        <div className="text-3xl font-bold text-gray-900">{startInfo}</div>
      </div>

      <div className="space-y-3">
        {players.length > 0 ? (
          players.map(player => (
            <div key={player.id} className="bg-gray-50 border-2 border-gray-400 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{player.name}</p>
            </div>
          ))
        ) : (
          <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-4 text-center">
            <p className="text-xl text-gray-500 italic">No players assigned</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg text-sm z-50">
        💡 A new window will open - set Destination to <strong>"Save as PDF"</strong> · Margins: <strong>None</strong>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-50">
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

      <div className="bg-gray-100 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4">
          <PlacardCard players={cart1Players} />
          <PlacardCard players={cart2Players} />
        </div>
      </div>

    </div>
  );
};

export default PrintableCartPlacard;