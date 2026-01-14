import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, X } from 'lucide-react';

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
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('name, logo_url, sponsor_logo_url, sponsor_logo_2_url')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Load group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, number, starting_hole, starting_position, tee_time')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      // Load players in group
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

      setGroup({
        ...groupData,
        players
      });

    } catch (error: any) {
      console.error('Error loading placard data:', error);
      alert(`Failed to load placard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  if (!group || !tournament) {
    return null;
  }

  const cart1Players = group.players.filter(p => p.cart_number === 1);
  const cart2Players = group.players.filter(p => p.cart_number === 2);
  const isShotgun = !!group.starting_hole;

  const PlacardCard = ({ cartNumber, players }: { cartNumber: number; players: Player[] }) => (
    <div className="w-full h-full flex flex-col border-4 border-green-600 rounded-xl p-6 bg-white shadow-2xl break-after-page overflow-hidden">
      {/* Top Section: All Three Logos in Row */}
      <div className="flex items-center justify-between mb-6 min-h-[80px]">
        {/* Left: Sponsor Logo 1 */}
        <div className="flex-1 flex justify-center items-center">
          {tournament.sponsor_logo_url ? (
            <img 
              src={tournament.sponsor_logo_url} 
              alt="Sponsor" 
              className="max-h-20 max-w-full object-contain"
            />
          ) : (
            <div className="w-20 h-20"></div>
          )}
        </div>

        {/* Center: Tournament Logo & Name */}
        <div className="flex-1 text-center px-4">
          {tournament.logo_url && (
            <img 
              src={tournament.logo_url} 
              alt="Tournament Logo" 
              className="h-20 mx-auto mb-2 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{tournament.name}</h1>
        </div>

        {/* Right: Sponsor Logo 2 */}
        <div className="flex-1 flex justify-center items-center">
          {tournament.sponsor_logo_2_url ? (
            <img 
              src={tournament.sponsor_logo_2_url} 
              alt="Sponsor" 
              className="max-h-20 max-w-full object-contain"
            />
          ) : (
            <div className="w-20 h-20"></div>
          )}
        </div>
      </div>

      {/* Starting Info */}
      <div className="text-center mb-6 bg-green-50 border-3 border-green-600 rounded-xl p-4">
        {isShotgun ? (
          <div className="text-3xl font-bold text-gray-900">
            Hole {group.starting_hole}
            {group.starting_position && (
              <span className="text-green-700"> (Tee {group.starting_position})</span>
            )}
          </div>
        ) : (
          <div className="text-3xl font-bold text-gray-900">
            {group.tee_time}
          </div>
        )}
      </div>

      {/* Players - No Heading, Larger Names */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="space-y-4">
          {players.length > 0 ? (
            players.map(player => (
              <div 
                key={player.id} 
                className="bg-gradient-to-r from-gray-50 to-gray-100 border-3 border-gray-400 rounded-xl p-5 text-center shadow-md"
              >
                <p className="text-3xl font-bold text-gray-900">{player.name}</p>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 border-3 border-gray-300 rounded-xl p-5 text-center">
              <p className="text-2xl text-gray-500 italic">No players assigned to this cart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Screen Controls */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" />
          Print Placards
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Printable Placards - 2 per page portrait */}
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-auto print:max-h-none print:overflow-visible">
        <div className="p-8 print:p-0">
          {/* Cart 1 Placard */}
          <div className="w-full h-[5in] mb-8 print:mb-0">
            <PlacardCard cartNumber={1} players={cart1Players} />
          </div>

          {/* Cart 2 Placard */}
          <div className="w-full h-[5in]">
            <PlacardCard cartNumber={2} players={cart2Players} />
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .break-after-page {
            page-break-after: always;
          }
          
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintableCartPlacard;