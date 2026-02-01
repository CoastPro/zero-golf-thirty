import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, LogOut, UserCog, Eye, EyeOff, Share2, Lock, Unlock, FileSpreadsheet, FileText, X, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Tournament, User, TournamentAccess, Player, Score, Group } from '../types/database.types';
import { useAuth } from '../context/AuthContext';
import { buildLeaderboard, buildSkinsLeaderboard, assignRanks, assignStablefordRanks } from '../lib/calculations';

type ScoringType = 'gross' | 'net' | 'stableford';

interface PDFOptions {
  scoringTypes: ScoringType[];
  scoringOrder: ScoringType[];
  includeOverall: boolean;
  includeByFlight: boolean;
  includeHoleByHole: boolean;
  includeSkins: boolean;
  includeGroups: boolean;
  includeCourseInfo: boolean;
  includeLogo: boolean;
  includeSponsorLogos: boolean;
  showHandicaps: boolean;
  showQuotas: boolean;
}

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tournamentAccess, setTournamentAccess] = useState<TournamentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedTournamentForPdf, setSelectedTournamentForPdf] = useState<{ id: string; name: string } | null>(null);
  const [pdfOptions, setPdfOptions] = useState<PDFOptions>({
    scoringTypes: ['gross', 'stableford'],
    scoringOrder: ['gross', 'stableford'],
    includeOverall: true,
    includeByFlight: true,
    includeHoleByHole: true,
    includeSkins: true,
    includeGroups: false,
    includeCourseInfo: true,
    includeLogo: true,
    includeSponsorLogos: true,
    showHandicaps: true,
    showQuotas: true
  });

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) throw usersError;
      setAllUsers(usersData || []);

      const { data: accessData, error: accessError } = await supabase
        .from('tournament_access')
        .select('*');

      if (accessError) throw accessError;
      setTournamentAccess(accessData || []);

      let query = supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (user?.role === 'sub_admin') {
        const { data: sharedTournamentIds } = await supabase
          .from('tournament_access')
          .select('tournament_id')
          .eq('user_id', user.id);

        const sharedIds = sharedTournamentIds?.map(t => t.tournament_id) || [];

        let subAdminQuery = supabase
          .from('tournaments')
          .select('*');

        if (sharedIds.length > 0) {
          subAdminQuery = subAdminQuery.or(`created_by.eq.${user.id},id.in.(${sharedIds.join(',')})`);
        } else {
          subAdminQuery = subAdminQuery.eq('created_by', user.id);
        }

        const { data: tournamentsData, error: tournamentsError } = await subAdminQuery
          .order('created_at', { ascending: false });

        if (tournamentsError) throw tournamentsError;
        setTournaments(tournamentsData || []);
      } else {
        const { data, error } = await query;
        if (error) throw error;
        setTournaments(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const toggleVisibility = async (tournamentId: string, currentVisibility: boolean) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ visible_to_players: !currentVisibility })
        .eq('id', tournamentId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    }
  };

  const finalizeTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Finalize "${tournamentName}"?\n\nThis will:\n- Lock ALL scores across all groups\n- Prevent any further edits\n\nYou can unlock later if needed.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          finalized: true,
          finalized_at: new Date().toISOString(),
          finalized_by: user?.id
        })
        .eq('id', tournamentId);

      if (error) throw error;

      alert('✅ Tournament finalized! All scores are now locked.');
      loadData();
    } catch (error) {
      console.error('Error finalizing tournament:', error);
      alert('Failed to finalize tournament');
    }
  };

  const unlockTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Unlock "${tournamentName}"?\n\nThis will:\n- Unlock the tournament\n- Unlock ALL groups\n- Allow scores to be edited again`)) {
      return;
    }

    try {
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({
          finalized: false,
          finalized_at: null,
          finalized_by: null
        })
        .eq('id', tournamentId);

      if (tournamentError) throw tournamentError;

      const { error: groupsError } = await supabase
        .from('groups')
        .update({
          round_finished: false,
          finished_at: null,
          locked_by_admin: false
        })
        .eq('tournament_id', tournamentId);

      if (groupsError) throw groupsError;

      alert('🔓 Tournament unlocked! All groups can edit scores again.');
      loadData();
    } catch (error) {
      console.error('Error unlocking tournament:', error);
      alert('Failed to unlock tournament');
    }
  };

  const openPdfModal = (tournamentId: string, tournamentName: string) => {
    setSelectedTournamentForPdf({ id: tournamentId, name: tournamentName });
    setPdfModalOpen(true);
  };

  const closePdfModal = () => {
    setPdfModalOpen(false);
    setSelectedTournamentForPdf(null);
  };

  const toggleScoringType = (type: ScoringType) => {
    if (pdfOptions.scoringTypes.includes(type)) {
      setPdfOptions({
        ...pdfOptions,
        scoringTypes: pdfOptions.scoringTypes.filter(t => t !== type),
        scoringOrder: pdfOptions.scoringOrder.filter(t => t !== type)
      });
    } else {
      setPdfOptions({
        ...pdfOptions,
        scoringTypes: [...pdfOptions.scoringTypes, type],
        scoringOrder: [...pdfOptions.scoringOrder, type]
      });
    }
  };

  const moveScoringTypeUp = (type: ScoringType) => {
    const index = pdfOptions.scoringOrder.indexOf(type);
    if (index > 0) {
      const newOrder = [...pdfOptions.scoringOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      setPdfOptions({ ...pdfOptions, scoringOrder: newOrder });
    }
  };

  const moveScoringTypeDown = (type: ScoringType) => {
    const index = pdfOptions.scoringOrder.indexOf(type);
    if (index < pdfOptions.scoringOrder.length - 1) {
      const newOrder = [...pdfOptions.scoringOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setPdfOptions({ ...pdfOptions, scoringOrder: newOrder });
    }
  };

  const getScoringTypeLabel = (type: ScoringType): string => {
    switch (type) {
      case 'gross': return 'Gross Standings';
      case 'net': return 'Net Standings';
      case 'stableford': return 'Stableford Standings';
    }
  };

  const exportToPdf = async () => {
    if (!selectedTournamentForPdf) return;

    setExporting(selectedTournamentForPdf.id);
    closePdfModal();

    try {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', selectedTournamentForPdf.id)
        .single();

      if (tournamentError) throw tournamentError;

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', selectedTournamentForPdf.id)
        .order('name');

      if (playersError) throw playersError;

      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('player_id', (players || []).map(p => p.id));

      if (scoresError) throw scoresError;

      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', selectedTournamentForPdf.id)
        .order('number');

      if (groupsError) throw groupsError;

      const { data: groupPlayers, error: gpError } = await supabase
        .from('group_players')
        .select('*')
        .in('group_id', (groups || []).map(g => g.id));

      if (gpError) throw gpError;

      const doc = new jsPDF();
      let yPos = 10;

      // Add tournament logo with proper aspect ratio
      if (pdfOptions.includeLogo && tournament.tournament_logo_url) {
        try {
          const img = new Image();
          img.src = tournament.tournament_logo_url;
          await new Promise((resolve) => { img.onload = resolve; });
          
          const maxWidth = 50;
          const maxHeight = 25;
          const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
          const width = img.width * ratio;
          const height = img.height * ratio;
          
          doc.addImage(tournament.tournament_logo_url, 'PNG', 15, yPos, width, height);
          yPos += height + 5;
        } catch (e) {
          console.error('Failed to add logo:', e);
          yPos += 10;
        }
      }

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(tournament.name, 105, yPos, { align: 'center' });
      yPos += 10;

      if (tournament.course_name) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(tournament.course_name, 105, yPos, { align: 'center' });
        yPos += 8;
      }

      if (tournament.tournament_date) {
        doc.setFontSize(10);
        doc.text(new Date(tournament.tournament_date + 'T00:00:00').toLocaleDateString(), 105, yPos, { align: 'center' });
        yPos += 10;
      }

      // Add sponsor logos with proper aspect ratio
      if (pdfOptions.includeSponsorLogos && (tournament.leaderboard_logo_left || tournament.leaderboard_logo_right)) {
        const logoYPos = yPos;
        
        if (tournament.leaderboard_logo_left) {
          try {
            const img = new Image();
            img.src = tournament.leaderboard_logo_left;
            await new Promise((resolve) => { img.onload = resolve; });
            
            const maxWidth = 40;
            const maxHeight = 20;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            const width = img.width * ratio;
            const height = img.height * ratio;
            
            doc.addImage(tournament.leaderboard_logo_left, 'PNG', 15, logoYPos, width, height);
          } catch (e) {
            console.error('Failed to add left sponsor logo:', e);
          }
        }
        
        if (tournament.leaderboard_logo_right) {
          try {
            const img = new Image();
            img.src = tournament.leaderboard_logo_right;
            await new Promise((resolve) => { img.onload = resolve; });
            
            const maxWidth = 40;
            const maxHeight = 20;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            const width = img.width * ratio;
            const height = img.height * ratio;
            
            doc.addImage(tournament.leaderboard_logo_right, 'PNG', 195 - width, logoYPos, width, height);
          } catch (e) {
            console.error('Failed to add right sponsor logo:', e);
          }
        }
        
        yPos += 25;
      }

      // Helper function to add standings table
      const addStandingsTable = (type: ScoringType, flight: string | null) => {
        const leaderboard = buildLeaderboard(players || [], scores || [], tournament, flight);
        
        // Apply ranking based on type
        let rankedLeaderboard;
        if (type === 'stableford') {
          rankedLeaderboard = assignStablefordRanks(
            leaderboard,
            (entry) => entry.stablefordPoints,
            (entry) => entry.vsQuota,
            (entry) => entry.holesPlayed > 0
          );
        } else {
          // For gross and net, use assignRanks
          rankedLeaderboard = assignRanks(
            leaderboard,
            (entry) => type === 'net' ? (entry.netScore || 999) : entry.vsParGross,
            (entry) => entry.holesPlayed > 0
          );
        }

let title = '';
if (type === 'gross') title = 'Gross Standings';
if (type === 'net') title = 'Net Standings';
if (type === 'stableford') title = 'Stableford Standings';

if (flight) {
  title += ` - Flight ${flight}`;
} else {
  title += ' - Overall';
}

        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 15, yPos);
        yPos += 5;

        // Build headers (REMOVED "Played" column)
        const headers = ['Rank', 'Player'];
        if (!flight) headers.push('Flight');
        if (pdfOptions.showHandicaps) headers.push('HC');
        if (pdfOptions.showQuotas && type === 'stableford') headers.push('Quota');
        
        if (type === 'gross') {
          headers.push('Score', '±');
        } else if (type === 'net') {
          headers.push('Net', '±');
        } else if (type === 'stableford') {
          headers.push('Points', 'vs Quota'); // CHANGED from "vs Q"
        }

        // Build rows using rank from rankedLeaderboard
        const rows = rankedLeaderboard.map((entry) => {
          const row: any[] = [
            entry.rank, // Use the calculated rank with T prefix
            entry.player.name
          ];
          if (!flight) row.push(entry.player.flight);
          if (pdfOptions.showHandicaps) row.push(entry.player.handicap);
          if (pdfOptions.showQuotas && type === 'stableford') row.push(entry.player.quota);

          if (type === 'gross') {
            row.push(
              entry.holesPlayed > 0 ? entry.grossScore : '-',
              entry.holesPlayed > 0 ? (entry.vsParGross > 0 ? `+${entry.vsParGross}` : entry.vsParGross) : '-'
            );
          } else if (type === 'net') {
            row.push(
              entry.netScore !== null ? entry.netScore : '-',
              entry.vsParNet !== null ? (entry.vsParNet > 0 ? `+${entry.vsParNet}` : entry.vsParNet) : '-'
            );
          } else if (type === 'stableford') {
            row.push(
              entry.holesPlayed > 0 ? entry.stablefordPoints : '-',
              entry.holesPlayed > 0 ? (entry.vsQuota > 0 ? `+${entry.vsQuota.toFixed(1)}` : entry.vsQuota.toFixed(1)) : '-'
            );
          }

          return row;
        });

        (autoTable as any)(doc, {
          startY: yPos,
          head: [headers],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          columnStyles: { 0: { cellWidth: 15 } } // WIDENED from 10 to 15
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      };

      // Generate standings tables in order
      for (const type of pdfOptions.scoringOrder) {
        if (pdfOptions.scoringTypes.includes(type)) {
          if (pdfOptions.includeOverall) {
            addStandingsTable(type, null);
          }
          
          if (pdfOptions.includeByFlight) {
            for (const flight of tournament.flights) {
              addStandingsTable(type, flight);
            }
          }
        }
      }

      // HOLE BY HOLE
      if (pdfOptions.includeHoleByHole) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Hole-by-Hole Scores', 15, yPos);
        yPos += 5;

        const holeHeaders = ['Player', 'Flt'];
        if (pdfOptions.showHandicaps) holeHeaders.push('HC');
        for (let i = 1; i <= 18; i++) holeHeaders.push(i.toString());
        holeHeaders.push('Tot');

        const holeRows = (players || []).map(player => {
          const playerScores = (scores || []).filter(s => s.player_id === player.id);
          const row: any[] = [player.name, player.flight];
          if (pdfOptions.showHandicaps) row.push(player.handicap);
          
          for (let hole = 1; hole <= 18; hole++) {
            const score = playerScores.find(s => s.hole === hole);
            row.push(score?.score || '-');
          }
          
          const totalScore = playerScores.reduce((sum, s) => sum + (s.score || 0), 0);
          row.push(playerScores.length > 0 ? totalScore : '-');
          
          return row;
        });

        (autoTable as any)(doc, {
          startY: yPos,
          head: [holeHeaders],
          body: holeRows,
          theme: 'grid',
          headStyles: { fillColor: [22, 101, 52], fontSize: 6 },
          bodyStyles: { fontSize: 5 },
          columnStyles: { 0: { cellWidth: 25 } }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // SKINS
      if (pdfOptions.includeSkins && tournament.skins_enabled) {
        const skinsData = buildSkinsLeaderboard(players || [], scores || [], tournament);

        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Skins Results', 15, yPos);
        yPos += 5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Pot: $${skinsData.totalPot.toFixed(2)} | Skins Won: ${skinsData.skinsWon} | Value Per Skin: $${skinsData.valuePerSkin.toFixed(2)} | Type: ${tournament.skins_type.toUpperCase()}`, 15, yPos);
        yPos += 7;

        if (skinsData.leaderboard.length > 0) {
          const skinsHeaders = ['Rank', 'Player', 'Flight', 'Skins', 'Holes', 'Winnings'];
          const skinsRows = skinsData.leaderboard.map((entry, index) => [
            index + 1,
            entry.player.name,
            entry.player.flight,
            entry.skins,
            entry.holes.sort((a, b) => a - b).join(', '),
            `$${entry.winnings.toFixed(2)}`
          ]);

          (autoTable as any)(doc, {
            startY: yPos,
            head: [skinsHeaders],
            body: skinsRows,
            theme: 'grid',
            headStyles: { fillColor: [22, 101, 52], fontSize: 9 },
            bodyStyles: { fontSize: 8 }
          });

          yPos = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // GROUPS
      if (pdfOptions.includeGroups) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Groups & Tee Times', 15, yPos);
        yPos += 5;

        const groupsHeaders = ['Group', 'Start Hole', 'Tee Pos', 'Tee Time', 'Players', 'Status'];
        const groupsRows = (groups || []).map(group => {
          const groupPlayersList = (groupPlayers || [])
            .filter(gp => gp.group_id === group.id)
            .map(gp => {
              const player = (players || []).find(p => p.id === gp.player_id);
              return player ? player.name : '';
            })
            .join(', ');

          return [
            group.number,
            group.starting_hole || '-',
            group.starting_position || '-',
            group.tee_time || '-',
            groupPlayersList,
            group.round_finished ? 'Finished' : 'In Progress'
          ];
        });

        (autoTable as any)(doc, {
          startY: yPos,
          head: [groupsHeaders],
          body: groupsRows,
          theme: 'grid',
          headStyles: { fillColor: [22, 101, 52], fontSize: 8 },
          bodyStyles: { fontSize: 7 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // COURSE INFO
      if (pdfOptions.includeCourseInfo) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Course Information', 15, yPos);
        yPos += 5;

        const courseHeaders = ['Hole', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'OUT', '10', '11', '12', '13', '14', '15', '16', '17', '18', 'IN', 'TOT'];
        const parRow = ['Par'];
        
        for (let i = 0; i < 9; i++) {
          parRow.push(tournament.course_par[i].toString());
        }
        parRow.push(tournament.course_par.slice(0, 9).reduce((a: number, b: number) => a + b, 0).toString());
        
        for (let i = 9; i < 18; i++) {
          parRow.push(tournament.course_par[i].toString());
        }
        parRow.push(tournament.course_par.slice(9, 18).reduce((a: number, b: number) => a + b, 0).toString());
        parRow.push(tournament.course_par.reduce((a: number, b: number) => a + b, 0).toString());

        (autoTable as any)(doc, {
          startY: yPos,
          head: [courseHeaders],
          body: [parRow],
          theme: 'grid',
          headStyles: { fillColor: [22, 101, 52], fontSize: 7 },
          bodyStyles: { fontSize: 7 }
        });
      }

      const date = new Date().toISOString().split('T')[0];
      const filename = `${selectedTournamentForPdf.name.replace(/[^a-z0-9]/gi, '_')}_Results_${date}.pdf`;

      doc.save(filename);

      alert('✅ PDF downloaded successfully!');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export to PDF');
    } finally {
      setExporting(null);
    }
  };

  const exportToExcel = async (tournamentId: string, tournamentName: string) => {
    setExporting(tournamentId);
    try {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (playersError) throw playersError;

      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('player_id', (players || []).map(p => p.id));

      if (scoresError) throw scoresError;

      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('number');

      if (groupsError) throw groupsError;

      const { data: groupPlayers, error: gpError } = await supabase
        .from('group_players')
        .select('*')
        .in('group_id', (groups || []).map(g => g.id));

      if (gpError) throw gpError;

      const wb = XLSX.utils.book_new();

      const leaderboard = buildLeaderboard(players || [], scores || [], tournament, null);
      const standingsData = leaderboard.map((entry, index) => ({
        'Rank': entry.holesPlayed === 0 ? '-' : index + 1,
        'Player': entry.player.name,
        'Flight': entry.player.flight,
        'Handicap': entry.player.handicap,
        'Quota': entry.player.quota,
        'Holes Played': entry.holesPlayed,
        'Gross Score': entry.holesPlayed > 0 ? entry.grossScore : '-',
        'vs Par (Gross)': entry.holesPlayed > 0 ? (entry.vsParGross > 0 ? `+${entry.vsParGross}` : entry.vsParGross) : '-',
        'Net Score': entry.netScore !== null ? entry.netScore : '-',
        'vs Par (Net)': entry.vsParNet !== null ? (entry.vsParNet > 0 ? `+${entry.vsParNet}` : entry.vsParNet) : '-',
        'Stableford Points': entry.holesPlayed > 0 ? entry.stablefordPoints : '-',
        'vs Quota': entry.holesPlayed > 0 ? (entry.vsQuota > 0 ? `+${entry.vsQuota.toFixed(1)}` : entry.vsQuota.toFixed(1)) : '-'
      }));

      const standingsSheet = XLSX.utils.json_to_sheet(standingsData);
      XLSX.utils.book_append_sheet(wb, standingsSheet, 'Final Standings');

      const holeByHoleData: any[] = [];
      (players || []).forEach(player => {
        const playerScores = (scores || []).filter(s => s.player_id === player.id);
        const row: any = {
          'Player': player.name,
          'Flight': player.flight,
          'Handicap': player.handicap
        };
        
        for (let hole = 1; hole <= 18; hole++) {
          const score = playerScores.find(s => s.hole === hole);
          row[`Hole ${hole}`] = score?.score || '-';
        }
        
        const totalScore = playerScores.reduce((sum, s) => sum + (s.score || 0), 0);
        row['Total'] = playerScores.length > 0 ? totalScore : '-';
        
        holeByHoleData.push(row);
      });

      const holeByHoleSheet = XLSX.utils.json_to_sheet(holeByHoleData);
      XLSX.utils.book_append_sheet(wb, holeByHoleSheet, 'Hole by Hole');

      if (tournament.skins_enabled) {
        const skinsData = buildSkinsLeaderboard(players || [], scores || [], tournament);
        
        const skinsLeaderboardData = skinsData.leaderboard.map((entry, index) => ({
          'Rank': index + 1,
          'Player': entry.player.name,
          'Flight': entry.player.flight,
          'Skins Won': entry.skins,
          'Holes': entry.holes.sort((a, b) => a - b).join(', '),
          'Winnings': `$${entry.winnings.toFixed(2)}`
        }));

        const skinsSheet = XLSX.utils.json_to_sheet(skinsLeaderboardData);
        XLSX.utils.book_append_sheet(wb, skinsSheet, 'Skins');

        const skinsSummary = [
          { 'Summary': 'Total Pot', 'Value': `$${skinsData.totalPot.toFixed(2)}` },
          { 'Summary': 'Skins Won', 'Value': skinsData.skinsWon },
          { 'Summary': 'Value Per Skin', 'Value': `$${skinsData.valuePerSkin.toFixed(2)}` },
          { 'Summary': 'Type', 'Value': tournament.skins_type.toUpperCase() }
        ];
        
        XLSX.utils.sheet_add_json(skinsSheet, skinsSummary, { origin: -1, skipHeader: false });
      }

      const groupsData = (groups || []).map(group => {
        const groupPlayersList = (groupPlayers || [])
          .filter(gp => gp.group_id === group.id)
          .map(gp => {
            const player = (players || []).find(p => p.id === gp.player_id);
            return player ? `${player.name} (Cart ${gp.cart_number || '-'})` : '';
          })
          .join(', ');

        return {
          'Group': group.number,
          'Starting Hole': group.starting_hole || '-',
          'Tee Position': group.starting_position || '-',
          'Tee Time': group.tee_time || '-',
          'Players': groupPlayersList,
          'Status': group.round_finished ? 'Finished' : 'In Progress'
        };
      });

      const groupsSheet = XLSX.utils.json_to_sheet(groupsData);
      XLSX.utils.book_append_sheet(wb, groupsSheet, 'Groups');

      const courseData = tournament.course_par.map((par: number, index: number) => ({
        'Hole': index + 1,
        'Par': par
      }));

      const frontNine = tournament.course_par.slice(0, 9).reduce((a: number, b: number) => a + b, 0);
      const backNine = tournament.course_par.slice(9, 18).reduce((a: number, b: number) => a + b, 0);

      courseData.push({ 'Hole': 'OUT', 'Par': frontNine });
      courseData.push({ 'Hole': 'IN', 'Par': backNine });
      courseData.push({ 'Hole': 'TOTAL', 'Par': frontNine + backNine });

      const courseSheet = XLSX.utils.json_to_sheet(courseData);
      XLSX.utils.book_append_sheet(wb, courseSheet, 'Course Info');

      const date = new Date().toISOString().split('T')[0];
      const filename = `${tournamentName.replace(/[^a-z0-9]/gi, '_')}_Results_${date}.xlsx`;

      XLSX.writeFile(wb, filename);

      alert('✅ Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel');
    } finally {
      setExporting(null);
    }
  };

  const toggleUserAccess = async (tournamentId: string, userId: string) => {
    try {
      const hasAccess = tournamentAccess.some(
        a => a.tournament_id === tournamentId && a.user_id === userId
      );

      if (hasAccess) {
        const { error } = await supabase
          .from('tournament_access')
          .delete()
          .eq('tournament_id', tournamentId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tournament_access')
          .insert({
            tournament_id: tournamentId,
            user_id: userId,
            granted_by: user?.id
          });

        if (error) throw error;
      }

      loadData();
    } catch (error) {
      console.error('Error toggling access:', error);
      alert('Failed to update access');
    }
  };

  const deleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Are you sure you want to delete "${tournamentName}"? This will delete all players, groups, and scores. This cannot be undone!`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      alert('Tournament deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament');
    }
  };

  const getSharedUsers = (tournamentId: string): User[] => {
    const accessRecords = tournamentAccess.filter(a => a.tournament_id === tournamentId);
    return allUsers.filter(u => 
      accessRecords.some(a => a.user_id === u.id) && u.role === 'sub_admin'
    );
  };

  const canManageTournament = (tournament: Tournament): boolean => {
    if (user?.role === 'master_admin') return true;
    if (tournament.created_by === user?.id) return true;
    return tournamentAccess.some(
      a => a.tournament_id === tournament.id && a.user_id === user?.id
    );
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No date';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString();
  };

  if (!user) return null;

  const subAdmins = allUsers.filter(u => u.role === 'sub_admin');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome, {user.name} {user.role === 'master_admin' && '(Master Admin)'}
              </p>
            </div>
            <div className="flex gap-3">
              {user.role === 'master_admin' && (
                <Link
                  to="/admin/users"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <UserCog className="w-5 h-5" />
                  Manage Users
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Options Modal */}
      {pdfModalOpen && selectedTournamentForPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">PDF Export Options</h3>
              <button onClick={closePdfModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Customize PDF export for <strong>{selectedTournamentForPdf.name}</strong>
            </p>

            <div className="space-y-4 mb-6">
              {/* Scoring Types Section */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Scoring Types & Order</h4>
                <p className="text-xs text-gray-500 mb-2">Select which standings to include and arrange their order:</p>
                
                <div className="space-y-2">
                  {(['gross', 'net', 'stableford'] as ScoringType[]).map(type => (
                    <div key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pdfOptions.scoringTypes.includes(type)}
                        onChange={() => toggleScoringType(type)}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <span className="text-sm flex-1">{getScoringTypeLabel(type)}</span>
                      
                      {pdfOptions.scoringTypes.includes(type) && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveScoringTypeUp(type)}
                            disabled={pdfOptions.scoringOrder.indexOf(type) === 0}
                            className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveScoringTypeDown(type)}
                            disabled={pdfOptions.scoringOrder.indexOf(type) === pdfOptions.scoringOrder.length - 1}
                            className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-gray-500 ml-1">
                            #{pdfOptions.scoringOrder.indexOf(type) + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <hr />

              {/* Breakdown Options */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Results Breakdown</h4>
                
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeOverall}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeOverall: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Include Overall Standings</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeByFlight}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeByFlight: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Include Flight-by-Flight Breakdown</span>
                </label>
              </div>

              <hr />

              {/* Additional Content */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Additional Content</h4>
                
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeHoleByHole}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeHoleByHole: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Hole-by-Hole Scores</span>
                </label>

                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeSkins}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeSkins: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Skins Results</span>
                </label>

                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeGroups}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeGroups: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Groups & Tee Times</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeCourseInfo}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeCourseInfo: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Course Information</span>
                </label>
              </div>

              <hr />

              {/* Styling Options */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Styling</h4>

                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeLogo}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeLogo: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Include Tournament Logo</span>
                </label>

                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeSponsorLogos}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeSponsorLogos: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Include Sponsor Logos</span>
                </label>

                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.showHandicaps}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, showHandicaps: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Show Handicaps</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfOptions.showQuotas}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, showQuotas: e.target.checked })}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm">Show Quotas</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closePdfModal}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={exportToPdf}
                disabled={pdfOptions.scoringTypes.length === 0 || (!pdfOptions.includeOverall && !pdfOptions.includeByFlight)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate PDF
              </button>
            </div>

            {pdfOptions.scoringTypes.length === 0 && (
              <p className="text-xs text-red-600 mt-2 text-center">Please select at least one scoring type</p>
            )}
            {!pdfOptions.includeOverall && !pdfOptions.includeByFlight && (
              <p className="text-xs text-red-600 mt-2 text-center">Please select Overall or By Flight</p>
            )}
          </div>
        </div>
      )}

      {/* Tournament Cards - Rest of the component remains the same */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Tournaments</h2>
          <Link
            to="/admin/tournament/new"
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading tournaments...</div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
            <p className="text-gray-600 mb-6">Create your first tournament to get started</p>
            <Link
              to="/admin/tournament/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tournaments.map(tournament => {
              const sharedUsers = getSharedUsers(tournament.id);
              const isOwner = tournament.created_by === user?.id;
              const isMaster = user?.role === 'master_admin';
              const canManage = canManageTournament(tournament);

              return (
                <div
                  key={tournament.id}
                  className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-2 ${
                    tournament.finalized 
                      ? 'border-red-500' 
                      : 'border-transparent hover:border-green-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {tournament.name}
                        </h3>
                        
                        {tournament.finalized && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-bold">
                            <Lock className="w-4 h-4" />
                            FINALIZED
                          </span>
                        )}

                        <button
                          onClick={() => toggleVisibility(tournament.id, tournament.visible_to_players)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            tournament.visible_to_players
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={tournament.visible_to_players ? 'Visible to players' : 'Hidden from players'}
                        >
                          {tournament.visible_to_players ? (
                            <>
                              <Eye className="w-4 h-4" />
                              Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4" />
                              Hidden
                            </>
                          )}
                        </button>
                      </div>
                      {tournament.course_name && (
                        <p className="text-sm text-gray-600 mb-2">{tournament.course_name}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {tournament.tournament_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(tournament.tournament_date)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {tournament.flights.length} Flight{tournament.flights.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      {tournament.finalized && tournament.finalized_at && (
                        <p className="text-xs text-red-600 mt-2">
                          🔒 Finalized: {new Date(tournament.finalized_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {(isMaster || isOwner) && subAdmins.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Share2 className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Share with Sub-Admins:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subAdmins.map(subAdmin => {
                          const hasAccess = tournamentAccess.some(
                            a => a.tournament_id === tournament.id && a.user_id === subAdmin.id
                          );
                          const isCreator = tournament.created_by === subAdmin.id;

                          return (
                            <button
                              key={subAdmin.id}
                              onClick={() => !isCreator && toggleUserAccess(tournament.id, subAdmin.id)}
                              disabled={isCreator}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                isCreator
                                  ? 'bg-purple-100 text-purple-700 cursor-default'
                                  : hasAccess
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {subAdmin.name} {isCreator && '(Owner)'}
                            </button>
                          );
                        })}
                      </div>
                      {sharedUsers.length > 0 && (
                        <p className="text-xs text-gray-500 text-center mt-1">
                          {`${window.location.origin}/tournament/${tournament.slug || tournament.id}/login`}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Link
                          to={`/admin/tournament/${tournament.id}/players`}
                          className="flex-1 text-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
                        >
                          Manage
                        </Link>
                        <Link
                          to={`/admin/tournament/${tournament.id}/edit`}
                          className="flex-1 text-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm transition-colors"
                        >
                          Edit
                        </Link>
                        
                        <button
                          onClick={() => exportToExcel(tournament.id, tournament.name)}
                          disabled={exporting === tournament.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          {exporting === tournament.id ? '...' : 'Excel'}
                        </button>

                        <button
                          onClick={() => openPdfModal(tournament.id, tournament.name)}
                          disabled={exporting === tournament.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          <FileText className="w-4 h-4" />
                          PDF
                        </button>
                        
                        {tournament.finalized ? (
                          <button
                            onClick={() => unlockTournament(tournament.id, tournament.name)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium text-sm transition-colors"
                          >
                            <Unlock className="w-4 h-4" />
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => finalizeTournament(tournament.id, tournament.name)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium text-sm transition-colors"
                          >
                            <Lock className="w-4 h-4" />
                            Finalize
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteTournament(tournament.id, tournament.name)}
                          className="flex-1 text-center px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <Link
                      to={`/tournament/${tournament.id}/leaderboard`}
                      className="flex-1 text-center px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium text-sm transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}