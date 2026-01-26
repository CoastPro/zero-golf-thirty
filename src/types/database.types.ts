export interface Tournament {
  id: string;
  name: string;
  course_name: string | null;
  tournament_date: string | null;
  format: string;
  course_par: number[];
  flights: string[];
  skins_enabled: boolean;
  skins_buy_in: number;
  skins_type: string;
  skins_carryover: boolean;
  show_handicaps: boolean;
  show_quotas: boolean;
  stableford_points: StablefordPoints;
  leaderboard_settings?: {
    tabs: ('gross' | 'stableford' | 'skins')[];
    hidden: ('gross' | 'stableford' | 'skins')[];
  };
  player_display_settings?: {
    show_flight: boolean;
    show_handicap: boolean;
    show_quota: boolean;
  };
  leaderboard_logo_left?: string | null;
  leaderboard_logo_right?: string | null;
  created_by?: string | null;
  visible_to_players: boolean;
slug?: string | null;
tournament_logo_url?: string | null;
tournament_sponsor_logo_url?: string | null;
custom_buttons?: CustomButton[];
  created_at: string;
  updated_at: string;
}

export interface StablefordPoints {
  albatross: number;
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  doublePlus: number;
}

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  handicap: number;
  quota: number;
  flight: string;
  paid: boolean;
  in_skins: boolean;
  phone: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  tournament_id: string;
  number: number;
  starting_hole: number | null;
  starting_position: string | null;
  tee_time: string | null;
  qr_code: string | null;
  created_at: string;
}

export interface GroupPlayer {
  group_id: string;
  player_id: string;
  position: number;
  cart_number: number | null;
}

export interface Score {
  id: string;
  player_id: string;
  hole: number;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerWithScores extends Player {
  scores: Score[];
}

export interface GroupWithPlayers extends Group {
  players: Player[];
}

export interface LeaderboardEntry {
  player: Player;
  grossScore: number;
  netScore: number | null;
  vsParGross: number;
  vsParNet: number | null;
  stablefordPoints: number;
  vsQuota: number;
  holesPlayed: number;
  isComplete: boolean;
}

export interface SavedCourse {
  id: string;
  name: string;
  course_par: number[];
  created_at: string;
  updated_at: string;
}

export interface SavedPlayer {
  id: string;
  name: string;
  handicap: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  phone: string | null;
  pin: string;
  role: 'master_admin' | 'sub_admin';
  created_at: string;
  updated_at: string;
}

export interface TournamentAccess {
  tournament_id: string;
  user_id: string;
  granted_by: string | null;
  created_at: string;
}
export interface CustomButton {
  label: string;
  url: string;
}