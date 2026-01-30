import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';

interface HomePageSettings {
  welcomeMessage: string;
  showLogo: boolean;
  showSponsorLogos: boolean;
  showCourseName: boolean;
  showInstructions: boolean;
  instructions: string;
  instructionsTitle: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

const defaultSettings: HomePageSettings = {
  welcomeMessage: "Welcome to our tournament!",
  showLogo: true,
  showSponsorLogos: true,
  showCourseName: true,
  showInstructions: false,
  instructions: "",
  instructionsTitle: "Instructions",
  backgroundColor: "#1e40af",
  textColor: "#ffffff",
  accentColor: "#3b82f6"
};

interface PlayerMatch {
  id: string;
  name: string;
  group_id: string;
}

export default function TournamentLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerPhone, setPlayerPhone] = useState('');
  const [matchedPlayers, setMatchedPlayers] = useState<PlayerMatch[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadTournament();
  }, [slug]);

  const loadTournament = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      setTournament(data);
    } catch (error) {
      console.error('Error loading tournament:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setMatchedPlayers([]);

    try {
      if (playerPhone.length !== 4) {
        setError('Please enter the last 4 digits of your phone number');
        setLoading(false);
        return;
      }

      const { data: players, error: playerError } = await supabase
        .from('players')
        .select('id, name, group_players!inner(group_id)')
        .eq('tournament_id', tournament?.id)
        .like('phone', `%${playerPhone}`);

      if (playerError) throw playerError;

      if (!players || players.length === 0) {
        setError('Phone number not found. Please check with your tournament organizer.');
        setLoading(false);
        return;
      }

      // Filter to exact match of last 4 digits and check for group assignment
      const exactMatches = players.filter(p => p.phone?.slice(-4) === playerPhone);

      if (exactMatches.length === 0) {
        setError('Phone number not found. Please check with your tournament organizer.');
        setLoading(false);
        return;
      }

      // Check if players have groups
      const playersWithGroups = exactMatches.filter(p => 
        p.group_players && p.group_players.length > 0
      );

      if (playersWithGroups.length === 0) {
        setError('You have not been assigned to a group yet.');
        setLoading(false);
        return;
      }

      // If only one match, log them in directly
      if (playersWithGroups.length === 1) {
        loginPlayer(playersWithGroups[0]);
      } else {
        // Multiple matches - show selection
        const playerMatches: PlayerMatch[] = playersWithGroups.map(p => ({
          id: p.id,
          name: p.name,
          group_id: p.group_players[0].group_id
        }));
        setMatchedPlayers(playerMatches);
        setLoading(false);
      }
    } catch (error) {
      console.error('Player login error:', error);
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  const loginPlayer = (player: any) => {
    const groupId = player.group_players?.[0]?.group_id || player.group_id;

    // Store player info in sessionStorage
    sessionStorage.setItem('playerAuth', JSON.stringify({
      playerId: player.id,
      playerName: player.name,
      groupId: groupId,
      tournamentId: tournament?.id
    }));

    navigate(`/tournament/${tournament?.id}/score?group=${groupId}`);
  };

  const handlePlayerSelect = (player: PlayerMatch) => {
    loginPlayer({ ...player, group_players: [{ group_id: player.group_id }] });
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Tournament Not Found</h1>
          <p className="text-gray-600">Please check your link and try again.</p>
        </div>
      </div>
    );
  }

  // Get settings from database or use defaults
  const settings: HomePageSettings = (tournament as any).home_page_settings || defaultSettings;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 py-4 relative overflow-hidden"
      style={{ 
        backgroundColor: settings.backgroundColor,
        color: settings.textColor 
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, ${settings.textColor} 35px, ${settings.textColor} 36px)`
        }}></div>
      </div>

      <div className="w-full max-w-2xl space-y-3 relative z-10">
        
        {/* Tournament Logo */}
        {settings.showLogo && tournament.logo_url && (
          <div className="flex justify-center animate-fade-in">
            <img 
              src={tournament.logo_url} 
              alt="Tournament Logo" 
              className="max-h-20 md:max-h-32 object-contain drop-shadow-2xl"
            />
          </div>
        )}

        {/* Tournament Name */}
        <div className="text-center space-y-1 animate-fade-in-up">
          <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg">
            {tournament.name}
          </h1>
          {settings.showCourseName && tournament.course_name && (
            <p className="text-lg md:text-xl opacity-90">
              {tournament.course_name}
            </p>
          )}
        </div>

        {/* Sponsor Logos */}
        {settings.showSponsorLogos && (tournament.sponsor_logo_url || tournament.sponsor_logo_2_url) && (
          <div className="flex justify-center items-center gap-6 flex-wrap animate-fade-in-up animation-delay-200">
            {tournament.sponsor_logo_url && (
              <img 
                src={tournament.sponsor_logo_url} 
                alt="Sponsor" 
                className="max-h-12 md:max-h-16 object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
            )}
            {tournament.sponsor_logo_2_url && (
              <img 
                src={tournament.sponsor_logo_2_url} 
                alt="Sponsor" 
                className="max-h-12 md:max-h-16 object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        )}

        {/* Welcome Message */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-2xl animate-fade-in-up animation-delay-300 flex items-center justify-center min-h-[4rem] overflow-y-auto max-h-24">
          <p className="text-base md:text-lg font-medium text-center">
            {settings.welcomeMessage}
          </p>
        </div>

        {/* Instructions */}
        {settings.showInstructions && settings.instructions && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-2xl animate-fade-in-up animation-delay-400">
            <h2 className="text-xl font-bold mb-2 text-center">{settings.instructionsTitle}</h2>
            <div 
              className="text-center text-sm md:text-base opacity-90 whitespace-pre-wrap overflow-y-auto flex items-center justify-center min-h-[2rem]" 
              style={{ 
                maxHeight: '4rem'
              }}
            >
              {settings.instructions}
            </div>
          </div>
        )}

        {/* Login Form or Player Selection */}
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-2xl animate-fade-in-up animation-delay-500">
          {matchedPlayers.length === 0 ? (
            <>
              <h2 className="text-xl font-bold mb-4 text-center">Player Login</h2>
              
              <form onSubmit={handlePhoneSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-90">
                    Enter Last 4 Digits of Your Phone Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={playerPhone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPlayerPhone(value);
                      setError('');
                    }}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full px-4 py-3 text-xl text-center tracking-widest rounded-xl border-2 focus:ring-4 focus:ring-opacity-50 transition-all"
                    style={{ 
                      borderColor: settings.accentColor,
                      color: settings.backgroundColor,
                      backgroundColor: settings.textColor
                    }}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-center animate-shake">
                    <p className="font-medium text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || playerPhone.length !== 4}
                  className="w-full py-3 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ 
                    backgroundColor: settings.accentColor,
                    color: settings.textColor
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Checking...
                    </span>
                  ) : (
                    '→ Continue'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-4 text-center">Select Your Name</h2>
              <p className="text-sm opacity-90 mb-4 text-center">
                Multiple players found with phone ending in {playerPhone}
              </p>
              
              <div className="space-y-2">
                {matchedPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all"
                    style={{ 
                      backgroundColor: settings.accentColor,
                      color: settings.textColor
                    }}
                  >
                    {player.name}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setMatchedPlayers([]);
                  setPlayerPhone('');
                  setError('');
                }}
                className="w-full mt-4 py-2 text-sm opacity-75 hover:opacity-100 underline transition-opacity"
              >
                ← Back to phone entry
              </button>
            </>
          )}

          <div className="mt-4 pt-4 border-t border-white/20 text-center">
            <button
              onClick={() => navigate(`/tournament/${tournament.id}/leaderboard`)}
              className="text-sm opacity-75 hover:opacity-100 underline transition-opacity"
            >
              View Leaderboard →
            </button>
          </div>
        </div>

        {/* Custom Buttons */}
        {tournament.custom_buttons && tournament.custom_buttons.length > 0 && (
          <div className="space-y-2 animate-fade-in-up animation-delay-600">
            {tournament.custom_buttons.map((button, index) => (
              <a
                key={index}
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {button.label}
                <ExternalLink className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs opacity-50 pt-2">
          Powered by Zero Golf Thirty
        </div>
      </div>
    </div>
  );
}