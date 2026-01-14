import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, X } from 'lucide-react';

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
  qr_code: string | null;
  players: Player[];
}

interface Tournament {
  name: string;
  logo_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_logo_2_url: string | null;
  player_instructions: string | null;
  course_name: string;
  course_par: number[];
}

interface PrintableScorecardProps {
  groupId: string;
  onClose: () => void;
}

const PrintableScorecard: React.FC<PrintableScorecardProps> = ({ groupId, onClose }) => {
  const { id: tournamentId } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuota, setShowQuota] = useState(true);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, number, starting_hole, starting_position, tee_time, qr_code')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const { data: groupPlayersData, error: gpError } = await supabase
        .from('group_players')
        .select(`
          position,
          players (
            id,
            name,
            quota,
            handicap
          )
        `)
        .eq('group_id', groupId)
        .order('position');

      if (gpError) throw gpError;

      const players = (groupPlayersData || []).map((gp: any) => ({
        id: gp.players.id,
        name: gp.players.name,
        quota: gp.players.quota,
        handicap: gp.players.handicap
      }));

      setGroup({
        ...groupData,
        players
      });

    } catch (error: any) {
      console.error('Error loading scorecard data:', error);
      alert(`Failed to load scorecard data: ${error.message}`);
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
          <p>Loading scorecard...</p>
        </div>
      </div>
    );
  }

  if (!group || !tournament || !tournament.course_par) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <p className="text-red-600">Error: Missing data</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
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

  // Determine if shotgun or tee time
  const isShotgun = !!group.starting_hole;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Screen Controls */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
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
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Printable Scorecard - Landscape */}
      <div className="bg-white w-full max-w-7xl max-h-[90vh] overflow-auto print:max-h-none print:overflow-visible">
        <div className="p-6 print:p-3">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-green-600">
            {/* Left: Tournament Name & Course */}
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900 print:text-base">{tournament.name}</h1>
              <p className="text-sm text-gray-700 print:text-xs">{tournament.course_name}</p>
            </div>

            {/* Center: Group & Starting Info */}
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-green-700 print:text-base">Group {group.number}</div>
              {isShotgun ? (
                <div className="text-base font-semibold text-gray-900 print:text-sm">
                  Hole {group.starting_hole}
                  {group.starting_position && ` (Tee ${group.starting_position})`}
                </div>
              ) : (
                <div className="text-base font-semibold text-gray-900 print:text-sm">
                  {group.tee_time}
                </div>
              )}
            </div>

            {/* Right: Tournament Logo */}
            <div className="flex items-center justify-end flex-1">
              {tournament.logo_url && (
                <img src={tournament.logo_url} alt="Tournament Logo" className="h-14 print:h-12" />
              )}
            </div>
          </div>

          {/* Main Scorecard Table */}
          <div className="mb-3">
            <table className="w-full border-collapse border-2 border-gray-800 text-xs print:text-[10px]">
              <thead>
                {/* Hole Numbers */}
                <tr className="bg-green-600 text-white">
                  <th className="border border-gray-800 px-1 py-1 text-left" style={{width: '80px'}}>Player</th>
                  <th className="border border-gray-800 px-1 py-1 text-center" style={{width: '24px'}}>
                    {showQuota ? 'Q' : 'H'}
                  </th>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => (
                    <th key={hole} className="border border-gray-800 px-1 py-1 text-center font-bold" style={{width: '28px'}}>
                      {hole}
                    </th>
                  ))}
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold bg-green-700" style={{width: '32px'}}>OUT</th>
                  {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => (
                    <th key={hole} className="border border-gray-800 px-1 py-1 text-center font-bold" style={{width: '28px'}}>
                      {hole}
                    </th>
                  ))}
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold bg-green-700" style={{width: '32px'}}>IN</th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold bg-green-700" style={{width: '36px'}}>TOT</th>
                </tr>
                
                {/* Par Row */}
                <tr className="bg-yellow-100">
                  <td className="border border-gray-800 px-1 py-1 font-bold">PAR</td>
                  <td className="border border-gray-800"></td>
                  {frontNinePar.map((par, i) => (
                    <td key={i} className="border border-gray-800 px-1 py-1 text-center font-bold">
                      {par}
                    </td>
                  ))}
                  <td className="border border-gray-800 px-1 py-1 text-center font-bold bg-yellow-200">{frontTotal}</td>
                  {backNinePar.map((par, i) => (
                    <td key={i} className="border border-gray-800 px-1 py-1 text-center font-bold">
                      {par}
                    </td>
                  ))}
                  <td className="border border-gray-800 px-1 py-1 text-center font-bold bg-yellow-200">{backTotal}</td>
                  <td className="border border-gray-800 px-1 py-1 text-center font-bold bg-yellow-300">{totalPar}</td>
                </tr>
              </thead>
              
              <tbody>
                {/* Player Rows */}
                {group.players.map(player => (
                  <tr key={player.id}>
                    <td className="border border-gray-800 px-1 py-1 font-semibold truncate text-xs print:text-[10px]">
                      {player.name}
                    </td>
                    <td className="border border-gray-800 px-1 py-1 text-center text-xs">
                      {showQuota ? player.quota : player.handicap}
                    </td>
                    {/* Front 9 holes */}
                    {[...Array(9)].map((_, i) => (
                      <td key={i} className="border border-gray-800 px-0 py-1" style={{height: '32px'}}></td>
                    ))}
                    {/* Front 9 total */}
                    <td className="border border-gray-800 px-1 py-1 bg-gray-100"></td>
                    {/* Back 9 holes */}
                    {[...Array(9)].map((_, i) => (
                      <td key={`back-${i}`} className="border border-gray-800 px-0 py-1" style={{height: '32px'}}></td>
                    ))}
                    {/* Back 9 total */}
                    <td className="border border-gray-800 px-1 py-1 bg-gray-100"></td>
                    {/* Overall total */}
                    <td className="border border-gray-800 px-1 py-1 bg-gray-200"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Instructions - Single Line */}
          {tournament.player_instructions && (
            <div className="mb-3 text-center">
              <p className="text-xs font-medium text-gray-700 print:text-[10px]">
                {tournament.player_instructions}
              </p>
            </div>
          )}

          {/* Bottom Section: Sponsor Left - QR Center - Sponsor Right */}
          <div className="flex items-center justify-between gap-6">
            {/* Left Sponsor Logo */}
            <div className="flex-1 flex justify-center items-center" style={{height: '100px'}}>
              {tournament.sponsor_logo_url ? (
                <img 
                  src={tournament.sponsor_logo_url} 
                  alt="Sponsor" 
                  className="max-h-20 max-w-full object-contain print:max-h-16"
                />
              ) : (
                <div className="text-xs text-gray-400 print:text-[10px]">Sponsor Logo</div>
              )}
            </div>

            {/* Center: QR Code */}
            <div className="text-center flex flex-col items-center justify-center" style={{width: '140px'}}>
              {group.qr_code ? (
                <>
                  <p className="text-xs font-semibold mb-1 print:text-[10px]">Scan to Score</p>
                  <img src={group.qr_code} alt="Scoring QR Code" className="w-24 h-24" />
                </>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-400">QR Code</span>
                </div>
              )}
            </div>

            {/* Right Sponsor Logo */}
            <div className="flex-1 flex justify-center items-center" style={{height: '100px'}}>
              {tournament.sponsor_logo_2_url ? (
                <img 
                  src={tournament.sponsor_logo_2_url} 
                  alt="Sponsor" 
                  className="max-h-20 max-w-full object-contain print:max-h-16"
                />
              ) : (
                <div className="text-xs text-gray-400 print:text-[10px]">Sponsor Logo</div>
              )}
            </div>
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
          
          @page {
            size: letter landscape;
            margin: 0.25in 0.5in;
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

export default PrintableScorecard;