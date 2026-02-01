import { Player, Score, Tournament, LeaderboardEntry } from '../types/database.types';

export const calculateGrossScore = (scores: Score[]): number => {
  return scores.reduce((total, score) => total + (score.score || 0), 0);
};

export const calculateNetScore = (grossScore: number, handicap: number): number => {
  return grossScore - handicap;
};

export const calculateVsPar = (scores: Score[], coursePar: number[]): number => {
  let vsPar = 0;
  scores.forEach(score => {
    if (score.score && score.hole >= 1 && score.hole <= 18) {
      const holePar = coursePar[score.hole - 1];
      vsPar += (score.score - holePar);
    }
  });
  return vsPar;
};

export const getCoursePar = (coursePar: number[]): number => {
  return coursePar.reduce((sum, par) => sum + par, 0);
};

export const getProratedPar = (scores: Score[], coursePar: number[]): number => {
  let proratedPar = 0;
  scores.forEach(score => {
    if (score.score && score.hole >= 1 && score.hole <= 18) {
      proratedPar += coursePar[score.hole - 1];
    }
  });
  return proratedPar;
};

export const calculateStablefordPoints = (
  score: number | null,
  par: number,
  points: Tournament['stableford_points']
): number => {
  if (!score) return 0;
  
  const vsParHole = score - par;
  
  if (vsParHole <= -3) return points.albatross;
  if (vsParHole === -2) return points.eagle;
  if (vsParHole === -1) return points.birdie;
  if (vsParHole === 0) return points.par;
  if (vsParHole === 1) return points.bogey;
  return points.doublePlus;
};

export const calculateStablefordTotal = (
  scores: Score[],
  coursePar: number[],
  points: Tournament['stableford_points']
): number => {
  return scores.reduce((total, score) => {
    if (!score.score) return total;
    const par = coursePar[score.hole - 1];
    return total + calculateStablefordPoints(score.score, par, points);
  }, 0);
};

export const calculateProratedQuota = (
  holesPlayed: number,
  quota: number
): number => {
  return (quota / 18) * holesPlayed;
};

export const formatVsPar = (vsPar: number): string => {
  if (vsPar === 0) return 'E';
  if (vsPar > 0) return `+${vsPar}`;
  return `${vsPar}`;
};

export const formatHolesPlayed = (holesPlayed: number): string => {
  if (holesPlayed === 0) return '-';
  if (holesPlayed === 18) return 'F';
  return `${holesPlayed}`;
};

// Helper function to assign ranks with tie handling (for Gross/Net - lower is better)
export const assignRanks = <T>(
  entries: T[],
  getCompareValue: (entry: T) => number | null,
  hasPlayed: (entry: T) => boolean
): Array<T & { rank: string }> => {
  // Separate players with scores from those without
  const withScores = entries.filter(hasPlayed);
  const withoutScores = entries.filter(e => !hasPlayed(e));

  // Sort by compare value (lower is better)
  const sorted = [...withScores].sort((a, b) => {
    const valA = getCompareValue(a);
    const valB = getCompareValue(b);
    if (valA === null) return 1;
    if (valB === null) return -1;
    return valA - valB;
  });

  // Assign ranks
  const rankedWithScores = sorted.map((entry, index, arr) => {
    const currentValue = getCompareValue(entry);
    
    // Count how many players are BETTER (lower score)
    let position = 1;
    for (let i = 0; i < arr.length; i++) {
      const otherValue = getCompareValue(arr[i]);
      if (otherValue !== null && currentValue !== null && otherValue < currentValue) {
        position++;
      }
    }
    
    // Find how many players have the same score
    const tiedPlayers = arr.filter(e => getCompareValue(e) === currentValue);
    const isTied = tiedPlayers.length > 1;
    
    return {
      ...entry,
      rank: isTied ? `T${position}` : `${position}`
    };
  });

  // Players without scores get "-"
  const rankedWithoutScores = withoutScores.map(entry => ({
    ...entry,
    rank: '-'
  }));

  return [...rankedWithScores, ...rankedWithoutScores];
};

// Helper function for Stableford (higher is better)
export const assignStablefordRanks = <T>(
  entries: T[],
  getPoints: (entry: T) => number,
  getVsQuota: (entry: T) => number,
  hasPlayed: (entry: T) => boolean
): Array<T & { rank: string }> => {
  // Separate players with scores from those without
  const withScores = entries.filter(hasPlayed);
  const withoutScores = entries.filter(e => !hasPlayed(e));

  // Sort by vsQuota (desc), then by points (desc)
  const sorted = [...withScores].sort((a, b) => {
    const vsQuotaA = getVsQuota(a);
    const vsQuotaB = getVsQuota(b);
    
    if (vsQuotaB !== vsQuotaA) {
      return vsQuotaB - vsQuotaA; // Higher vsQuota is better
    }
    
    return getPoints(b) - getPoints(a); // Higher points is better
  });

  // Assign ranks with proper tie handling
  const rankedWithScores = sorted.map((entry, index, arr) => {
    const currentVsQuota = getVsQuota(entry);
    const currentPoints = getPoints(entry);
    
    // Count how many players are BETTER than this player
    let position = 1;
    for (let i = 0; i < arr.length; i++) {
      const otherVsQuota = getVsQuota(arr[i]);
      const otherPoints = getPoints(arr[i]);
      
      // Only count players that are strictly better
      if (otherVsQuota > currentVsQuota) {
        position++;
      } else if (otherVsQuota === currentVsQuota && otherPoints > currentPoints) {
        position++;
      } else if (otherVsQuota === currentVsQuota && otherPoints === currentPoints && i < index) {
        // Same score but processed earlier - don't increment position
        continue;
      }
    }
    
    // Find all tied players (same vsQuota AND same points)
    const tiedPlayers = arr.filter(e => 
      getVsQuota(e) === currentVsQuota && getPoints(e) === currentPoints
    );
    const isTied = tiedPlayers.length > 1;
    
    return {
      ...entry,
      rank: isTied ? `T${position}` : `${position}`
    };
  });

  // Players without scores get "-"
  const rankedWithoutScores = withoutScores.map(entry => ({
    ...entry,
    rank: '-'
  }));

  return [...rankedWithScores, ...rankedWithoutScores];
};

export const buildLeaderboard = (
  players: Player[],
  scores: Score[],
  tournament: Tournament,
  flightFilter: string | null = null
): LeaderboardEntry[] => {
  const coursePar = getCoursePar(tournament.course_par);
  
  const filteredPlayers = flightFilter 
    ? players.filter(p => p.flight === flightFilter)
    : players;
  
  const entries: LeaderboardEntry[] = filteredPlayers.map(player => {
    const playerScores = scores.filter(s => s.player_id === player.id && s.score !== null);
    const holesPlayed = playerScores.length;
    const isComplete = holesPlayed === 18;
    
    const grossScore = calculateGrossScore(playerScores);
    const proratedPar = getProratedPar(playerScores, tournament.course_par);
    const vsParGross = calculateVsPar(playerScores, tournament.course_par);
    
    const netScore = isComplete ? calculateNetScore(grossScore, player.handicap) : null;
    const vsParNet = netScore !== null ? (netScore - coursePar) : null;
    
    const stablefordPoints = calculateStablefordTotal(
      playerScores,
      tournament.course_par,
      tournament.stableford_points
    );
    
    const proratedQuota = calculateProratedQuota(holesPlayed, player.quota);
    const vsQuota = stablefordPoints - proratedQuota;
    
    return {
      player,
      grossScore,
      netScore,
      vsParGross,
      vsParNet,
      stablefordPoints,
      vsQuota,
      holesPlayed,
      isComplete
    };
  });
  
  // Sort: Players with scores first (by vsParGross, then grossScore), then players without scores
  return entries.sort((a, b) => {
    // Players with scores always come first
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    
    // Sort by vsParGross
    if (a.vsParGross !== b.vsParGross) {
      return a.vsParGross - b.vsParGross;
    }
    
    // If tied on vsParGross, sort by gross score
    return a.grossScore - b.grossScore;
  });
};

// Skins calculations
export interface SkinWinner {
  playerId: string;
  playerName: string;
  hole: number;
  score: number;
  skinsWon: number;
}

export const calculateSkins = (
  players: Player[],
  scores: Score[],
  tournament: Tournament
): { winners: SkinWinner[], totalPot: number, skinsWon: number, valuePerSkin: number } => {
  const skinsPlayers = players.filter(p => p.in_skins);
  const totalPot = skinsPlayers.length * tournament.skins_buy_in;
  
  if (skinsPlayers.length === 0) {
    return { winners: [], totalPot: 0, skinsWon: 0, valuePerSkin: 0 };
  }

  const winners: SkinWinner[] = [];
  let carryover = 1;

  for (let hole = 1; hole <= 18; hole++) {
    const holeScores: { player: Player; score: number | null; netScore: number | null }[] = [];

    skinsPlayers.forEach(player => {
      const scoreRecord = scores.find(s => s.player_id === player.id && s.hole === hole);
      const grossScore = scoreRecord?.score || null;
      
      let netScore = null;
      if (grossScore && tournament.skins_type === 'net') {
        netScore = grossScore - player.handicap;
      }

      holeScores.push({
        player,
        score: grossScore,
        netScore
      });
    });

    const validScores = holeScores.filter(hs => hs.score !== null);
    
    if (validScores.length === 0) continue;

    const scoresToCompare = validScores.map(hs => ({
      player: hs.player,
      compareScore: tournament.skins_type === 'net' && hs.netScore !== null ? hs.netScore : hs.score!
    }));

    const lowestScore = Math.min(...scoresToCompare.map(s => s.compareScore));
    const winnersThisHole = scoresToCompare.filter(s => s.compareScore === lowestScore);

    if (winnersThisHole.length === 1) {
      const winner = winnersThisHole[0];
      winners.push({
        playerId: winner.player.id,
        playerName: winner.player.name,
        hole,
        score: lowestScore,
        skinsWon: carryover
      });
      carryover = 1;
    } else if (tournament.skins_carryover) {
      carryover++;
    }
  }

  const totalSkinsWon = winners.reduce((sum, w) => sum + w.skinsWon, 0);
  const valuePerSkin = totalSkinsWon > 0 ? totalPot / totalSkinsWon : 0;

  return {
    winners,
    totalPot,
    skinsWon: totalSkinsWon,
    valuePerSkin
  };
};

export const buildSkinsLeaderboard = (
  players: Player[],
  scores: Score[],
  tournament: Tournament
) => {
  const { winners, totalPot, skinsWon, valuePerSkin } = calculateSkins(players, scores, tournament);
  
  const playerTotals = new Map<string, { player: Player; skins: number; winnings: number; holes: number[] }>();

  winners.forEach(winner => {
    const existing = playerTotals.get(winner.playerId);
    if (existing) {
      existing.skins += winner.skinsWon;
      existing.winnings += winner.skinsWon * valuePerSkin;
      existing.holes.push(winner.hole);
    } else {
      const player = players.find(p => p.id === winner.playerId)!;
      playerTotals.set(winner.playerId, {
        player,
        skins: winner.skinsWon,
        winnings: winner.skinsWon * valuePerSkin,
        holes: [winner.hole]
      });
    }
  });

  const leaderboard = Array.from(playerTotals.values()).sort((a, b) => b.skins - a.skins);

  return {
    leaderboard,
    totalPot,
    skinsWon,
    valuePerSkin,
    winners
  };
};