import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, X, GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, BookOpen, Upload, Image as ImageIcon, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database.types';
import { useAuth } from '../context/AuthContext';

const DEFAULT_PAR = [4, 4, 4, 3, 5, 4, 4, 3, 4, 4, 4, 4, 3, 5, 4, 4, 3, 4];
const DEFAULT_STABLEFORD = {
  albatross: 10,
  eagle: 7,
  birdie: 4,
  par: 2,
  bogey: 1,
  doublePlus: 0
};

const DEFAULT_HOME_PAGE_SETTINGS = {
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

type LeaderboardTab = 'gross' | 'stableford' | 'skins';

export default function TournamentSetup() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  const [format, setFormat] = useState('gross');
  const [coursePar, setCoursePar] = useState(DEFAULT_PAR);
  const [showHandicaps, setShowHandicaps] = useState(true);
  const [showQuotas, setShowQuotas] = useState(true);
  
  const [flights, setFlights] = useState(['A', 'B', 'C']);
  const [newFlightName, setNewFlightName] = useState('');
  
  const [skinsEnabled, setSkinsEnabled] = useState(false);
  const [skinsBuyIn, setSkinsBuyIn] = useState(10);
  const [skinsType, setSkinsType] = useState('gross');
  const [skinsCarryover, setSkinsCarryover] = useState(true);
  
  const [logoUrl, setLogoUrl] = useState('');
  const [sponsorLogo1Url, setSponsorLogo1Url] = useState('');
  const [sponsorLogo2Url, setSponsorLogo2Url] = useState('');
  const [playerInstructions, setPlayerInstructions] = useState('');
  
  const [leaderboardLogoLeft, setLeaderboardLogoLeft] = useState('');
  const [leaderboardLogoRight, setLeaderboardLogoRight] = useState('');
  
  const [leaderboardTabOrder, setLeaderboardTabOrder] = useState<LeaderboardTab[]>(['gross', 'stableford', 'skins']);
  const [leaderboardHiddenTabs, setLeaderboardHiddenTabs] = useState<LeaderboardTab[]>([]);
  
  const [savedCourses, setSavedCourses] = useState<any[]>([]);

  // Home Page Settings
  const [tournamentSlug, setTournamentSlug] = useState('');
  const [homePageSettings, setHomePageSettings] = useState(DEFAULT_HOME_PAGE_SETTINGS);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadTournament();
    }
  }, [id]);

  useEffect(() => {
    loadSavedCourses();
  }, []);

  const loadSavedCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_courses')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSavedCourses(data || []);
    } catch (error) {
      console.error('Error loading saved courses:', error);
    }
  };

  const loadCourse = (course: any) => {
    setCourseName(course.name);
    setCoursePar(course.course_par);
  };

  const loadTournament = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setName(data.name);
        setCourseName(data.course_name || '');
        setTournamentDate(data.tournament_date || '');
        setFormat(data.format);
        setCoursePar(data.course_par);
        setShowHandicaps(data.show_handicaps);
        setShowQuotas(data.show_quotas);
        setFlights(data.flights || ['A', 'B', 'C']);
        setSkinsEnabled(data.skins_enabled);
        setSkinsBuyIn(data.skins_buy_in);
        setSkinsType(data.skins_type);
        setSkinsCarryover(data.skins_carryover || true);
        setLogoUrl(data.logo_url || '');
        setSponsorLogo1Url(data.sponsor_logo_url || '');
        setSponsorLogo2Url(data.sponsor_logo_2_url || '');
        setPlayerInstructions(data.player_instructions || '');
        setLeaderboardLogoLeft(data.leaderboard_logo_left || '');
        setLeaderboardLogoRight(data.leaderboard_logo_right || '');
        setTournamentSlug(data.slug || '');
        
        // Load home page settings
        setHomePageSettings((data as any).home_page_settings || DEFAULT_HOME_PAGE_SETTINGS);
        
        // Load leaderboard settings
        if (data.leaderboard_settings) {
          setLeaderboardTabOrder(data.leaderboard_settings.tabs || ['gross', 'stableford', 'skins']);
          setLeaderboardHiddenTabs(data.leaderboard_settings.hidden || []);
        }
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      alert('Failed to load tournament');
    }
  };

  const uploadImage = async (file: File, type: 'logo' | 'sponsor1' | 'sponsor2') => {
    try {
      setUploading(type);

      const fileExt = file.name.split('.').pop();
      const fileName = `${id || 'temp'}/${type}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('tournament-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('tournament-assets')
        .getPublicUrl(fileName);

      if (type === 'logo') setLogoUrl(publicUrl);
      if (type === 'sponsor1') setSponsorLogo1Url(publicUrl);
      if (type === 'sponsor2') setSponsorLogo2Url(publicUrl);

      alert('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sponsor1' | 'sponsor2') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be smaller than 5MB');
        return;
      }
      uploadImage(file, type);
    }
  };

  const copyLoginUrl = () => {
    const url = `${window.location.origin}/tournament/${tournamentSlug}/login`;
    navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const addFlight = () => {
    if (newFlightName.trim() && !flights.includes(newFlightName.trim().toUpperCase())) {
      setFlights([...flights, newFlightName.trim().toUpperCase()]);
      setNewFlightName('');
    }
  };

  const removeFlight = (flightToRemove: string) => {
    if (flights.length > 1) {
      setFlights(flights.filter(f => f !== flightToRemove));
    } else {
      alert('You must have at least one flight');
    }
  };

  const moveTabUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...leaderboardTabOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setLeaderboardTabOrder(newOrder);
  };

  const moveTabDown = (index: number) => {
    if (index === leaderboardTabOrder.length - 1) return;
    const newOrder = [...leaderboardTabOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setLeaderboardTabOrder(newOrder);
  };

  const toggleTabVisibility = (tab: LeaderboardTab) => {
    if (leaderboardHiddenTabs.includes(tab)) {
      setLeaderboardHiddenTabs(leaderboardHiddenTabs.filter(t => t !== tab));
    } else {
      setLeaderboardHiddenTabs([...leaderboardHiddenTabs, tab]);
    }
  };

  const getTabLabel = (tab: LeaderboardTab): string => {
    if (tab === 'gross') return 'Gross / Net';
    if (tab === 'stableford') return 'Stableford';
    return 'Skins';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tournamentData = {
        name,
        course_name: courseName || null,
        tournament_date: tournamentDate || null,
        format,
        course_par: coursePar,
        flights: flights,
        skins_enabled: skinsEnabled,
        skins_buy_in: skinsBuyIn,
        skins_type: skinsType,
        skins_carryover: skinsCarryover,
        show_handicaps: showHandicaps,
        show_quotas: showQuotas,
        stableford_points: DEFAULT_STABLEFORD,
        logo_url: logoUrl || null,
        sponsor_logo_url: sponsorLogo1Url || null,
        sponsor_logo_2_url: sponsorLogo2Url || null,
        player_instructions: playerInstructions || null,
        leaderboard_logo_left: leaderboardLogoLeft || null,
        leaderboard_logo_right: leaderboardLogoRight || null,
        leaderboard_settings: {
          tabs: leaderboardTabOrder,
          hidden: leaderboardHiddenTabs
        },
        home_page_settings: homePageSettings,
        created_by: user?.id || null,
        visible_to_players: true
      };

      if (isEditing) {
        const { error } = await supabase
          .from('tournaments')
          .update(tournamentData)
          .eq('id', id);

        if (error) throw error;
        alert('Tournament updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('tournaments')
          .insert([tournamentData])
          .select()
          .single();

        if (error) throw error;
        alert('Tournament created successfully!');
        navigate(`/admin/tournament/${data.id}/players`);
      }
    } catch (error) {
      console.error('Error saving tournament:', error);
      alert('Failed to save tournament');
    } finally {
      setLoading(false);
    }
  };

  const updateHolePar = (holeIndex: number, value: string) => {
    const newPar = [...coursePar];
    newPar[holeIndex] = parseInt(value) || 3;
    setCoursePar(newPar);
  };

  const frontNinePar = coursePar.slice(0, 9).reduce((a, b) => a + b, 0);
  const backNinePar = coursePar.slice(9, 18).reduce((a, b) => a + b, 0);
  const totalPar = frontNinePar + backNinePar;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">
        {isEditing ? 'Edit Tournament' : 'Create New Tournament'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tournament Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Spring Championship 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name
              </label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Pine Valley Golf Club"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tournament Date
              </label>
              <input
                type="date"
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Logos & Branding */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Logos & Branding</h3>
          <p className="text-sm text-gray-600 mb-6">
            Upload logos to appear on scorecards and cart placards
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tournament Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tournament Logo
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Appears on scorecard (top-right) and placard (top-center)
              </p>
              
              {logoUrl && (
                <div className="mb-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <img src={logoUrl} alt="Tournament Logo" className="h-16 mx-auto object-contain" />
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'logo')}
                className="hidden"
                id="logo-upload"
                disabled={uploading === 'logo'}
              />
              <label
                htmlFor="logo-upload"
                className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors text-sm ${
                  uploading === 'logo' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading === 'logo' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </>
                )}
              </label>

              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Or paste URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 text-xs"
              />
            </div>

            {/* Sponsor Logo 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sponsor Logo 1
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Appears on scorecard & placard bottom-left
              </p>
              
              {sponsorLogo1Url && (
                <div className="mb-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <img src={sponsorLogo1Url} alt="Sponsor Logo 1" className="h-16 mx-auto object-contain" />
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'sponsor1')}
                className="hidden"
                id="sponsor1-upload"
                disabled={uploading === 'sponsor1'}
              />
              <label
                htmlFor="sponsor1-upload"
                className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors text-sm ${
                  uploading === 'sponsor1' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading === 'sponsor1' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </>
                )}
              </label>

              <input
                type="text"
                value={sponsorLogo1Url}
                onChange={(e) => setSponsorLogo1Url(e.target.value)}
                placeholder="Or paste URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 text-xs"
              />
            </div>

            {/* Sponsor Logo 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sponsor Logo 2
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Appears on scorecard & placard bottom-right
              </p>
              
              {sponsorLogo2Url && (
                <div className="mb-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <img src={sponsorLogo2Url} alt="Sponsor Logo 2" className="h-16 mx-auto object-contain" />
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'sponsor2')}
                className="hidden"
                id="sponsor2-upload"
                disabled={uploading === 'sponsor2'}
              />
              <label
                htmlFor="sponsor2-upload"
                className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors text-sm ${
                  uploading === 'sponsor2' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading === 'sponsor2' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </>
                )}
              </label>

              <input
                type="text"
                value={sponsorLogo2Url}
                onChange={(e) => setSponsorLogo2Url(e.target.value)}
                placeholder="Or paste URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 text-xs"
              />
            </div>
          </div>

          {/* Player Instructions */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player Instructions
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Brief instructions that appear on scorecard (keep it short - one line recommended)
            </p>
            <textarea
              value={playerInstructions}
              onChange={(e) => setPlayerInstructions(e.target.value)}
              placeholder="e.g., Mark scores immediately. Return carts by 5 PM."
              rows={2}
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {playerInstructions.length}/200 characters
            </p>
          </div>
        </div>

        {/* TOURNAMENT HOME PAGE */}
        {isEditing && tournamentSlug && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-blue-900">🏠 Tournament Home Page</h3>
              <a
                href={`/tournament/${tournamentSlug}/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Preview
              </a>
            </div>

            {/* Player Login URL */}
            <div className="mb-6 bg-white rounded-lg p-4 border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player Login URL
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Share this link with players. They'll login with last 4 digits of their phone number.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/tournament/${tournamentSlug}/login`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={copyLoginUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {urlCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="space-y-6">
              {/* Welcome Message */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Message
                </label>
                <input
                  type="text"
                  value={homePageSettings.welcomeMessage}
                  onChange={(e) => setHomePageSettings({...homePageSettings, welcomeMessage: e.target.value})}
                  placeholder="Welcome to our tournament!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Display Options */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-gray-900 mb-3">Display Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={homePageSettings.showLogo}
                      onChange={(e) => setHomePageSettings({...homePageSettings, showLogo: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Show Tournament Logo</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={homePageSettings.showCourseName !== undefined ? homePageSettings.showCourseName : true}
                      onChange={(e) => setHomePageSettings({...homePageSettings, showCourseName: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Show Course Name</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={homePageSettings.showSponsorLogos}
                      onChange={(e) => setHomePageSettings({...homePageSettings, showSponsorLogos: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Show Sponsor Logos</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={homePageSettings.showInstructions}
                      onChange={(e) => setHomePageSettings({...homePageSettings, showInstructions: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Show Instructions Section</span>
                  </label>
                </div>
              </div>

              {/* Instructions */}
              {homePageSettings.showInstructions && (
                <div className="bg-white rounded-lg p-4 border border-blue-200 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instructions Title
                    </label>
                    <input
                      type="text"
                      value={homePageSettings.instructionsTitle || "Instructions"}
                      onChange={(e) => setHomePageSettings({...homePageSettings, instructionsTitle: e.target.value})}
                      placeholder="Instructions"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instructions Content
                    </label>
                    <textarea
                      value={homePageSettings.instructions}
                      onChange={(e) => setHomePageSettings({...homePageSettings, instructions: e.target.value})}
                      placeholder="Enter tournament instructions here..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Color Scheme */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-gray-900 mb-3">Color Scheme</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={homePageSettings.backgroundColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, backgroundColor: e.target.value})}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={homePageSettings.backgroundColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, backgroundColor: e.target.value})}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Text</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={homePageSettings.textColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, textColor: e.target.value})}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={homePageSettings.textColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, textColor: e.target.value})}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Buttons</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={homePageSettings.accentColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, accentColor: e.target.value})}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={homePageSettings.accentColor}
                        onChange={(e) => setHomePageSettings({...homePageSettings, accentColor: e.target.value})}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Quick Presets</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => setHomePageSettings({...homePageSettings, backgroundColor: '#1e40af', textColor: '#ffffff', accentColor: '#3b82f6'})}
                      className="p-2 rounded-lg border-2 border-blue-700 hover:scale-105 transition-transform text-white text-xs font-semibold"
                      style={{backgroundColor: '#1e40af'}}
                    >
                      Blue
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomePageSettings({...homePageSettings, backgroundColor: '#065f46', textColor: '#ffffff', accentColor: '#10b981'})}
                      className="p-2 rounded-lg border-2 border-green-700 hover:scale-105 transition-transform text-white text-xs font-semibold"
                      style={{backgroundColor: '#065f46'}}
                    >
                      Green
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomePageSettings({...homePageSettings, backgroundColor: '#7c2d12', textColor: '#ffffff', accentColor: '#f97316'})}
                      className="p-2 rounded-lg border-2 border-orange-700 hover:scale-105 transition-transform text-white text-xs font-semibold"
                      style={{backgroundColor: '#7c2d12'}}
                    >
                      Orange
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomePageSettings({...homePageSettings, backgroundColor: '#7e22ce', textColor: '#ffffff', accentColor: '#a855f7'})}
                      className="p-2 rounded-lg border-2 border-purple-700 hover:scale-105 transition-transform text-white text-xs font-semibold"
                      style={{backgroundColor: '#7e22ce'}}
                    >
                      Purple
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomePageSettings({...homePageSettings, backgroundColor: '#1f2937', textColor: '#ffffff', accentColor: '#6b7280'})}
                      className="p-2 rounded-lg border-2 border-gray-700 hover:scale-105 transition-transform text-white text-xs font-semibold"
                      style={{backgroundColor: '#1f2937'}}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Leaderboard Settings</h3>
          <p className="text-sm text-gray-600 mb-6">
            Configure which leaderboards are visible to players and their display order
          </p>

          <div className="space-y-3 mb-6">
            {leaderboardTabOrder.map((tab, index) => (
              <div key={tab} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveTabUp(index)}
                      disabled={index === 0}
                      className="p-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTabDown(index)}
                      disabled={index === leaderboardTabOrder.length - 1}
                      className="p-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="font-semibold text-gray-900">{getTabLabel(tab)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleTabVisibility(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    leaderboardHiddenTabs.includes(tab)
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {leaderboardHiddenTabs.includes(tab) ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hidden
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Visible
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard Display (Bottom Logos) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Leaderboard Display</h3>
          <p className="text-sm text-gray-600 mb-6">
            Configure logos that appear at the bottom of the leaderboard page (80px tall)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bottom Left Logo
              </label>
              
              {leaderboardLogoLeft && (
                <div className="mb-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <img src={leaderboardLogoLeft} alt="Left Logo" className="h-20 mx-auto object-contain" />
                </div>
              )}

              <input
                type="text"
                value={leaderboardLogoLeft}
                onChange={(e) => setLeaderboardLogoLeft(e.target.value)}
                placeholder="Paste image URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoLeft(logoUrl)}
                  disabled={!logoUrl}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Tournament Logo
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoLeft(sponsorLogo1Url)}
                  disabled={!sponsorLogo1Url}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Sponsor 1
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoLeft(sponsorLogo2Url)}
                  disabled={!sponsorLogo2Url}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Sponsor 2
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoLeft('')}
                  className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Right Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bottom Right Logo
              </label>
              
              {leaderboardLogoRight && (
                <div className="mb-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <img src={leaderboardLogoRight} alt="Right Logo" className="h-20 mx-auto object-contain" />
                </div>
              )}

              <input
                type="text"
                value={leaderboardLogoRight}
                onChange={(e) => setLeaderboardLogoRight(e.target.value)}
                placeholder="Paste image URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoRight(logoUrl)}
                  disabled={!logoUrl}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Tournament Logo
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoRight(sponsorLogo1Url)}
                  disabled={!sponsorLogo1Url}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Sponsor 1
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoRight(sponsorLogo2Url)}
                  disabled={!sponsorLogo2Url}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  Use Sponsor 2
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardLogoRight('')}
                  className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Flights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Flights</h3>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {flights.map(flight => (
                <div key={flight} className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-lg">
                  <span className="font-semibold">Flight {flight}</span>
                  <button
                    type="button"
                    onClick={() => removeFlight(flight)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newFlightName}
                onChange={(e) => setNewFlightName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFlight())}
                placeholder="Flight name (e.g., D, E, Championship)"
                maxLength={20}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={addFlight}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Flight
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Add custom flight names. Players will be assigned to these flights.
            </p>
          </div>
        </div>

        {/* Scoring Format */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Scoring Format</h3>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="gross"
                checked={format === 'gross'}
                onChange={(e) => setFormat(e.target.value)}
                className="w-4 h-4 text-green-600"
              />
              <span>Gross Only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="net"
                checked={format === 'net'}
                onChange={(e) => setFormat(e.target.value)}
                className="w-4 h-4 text-green-600"
              />
              <span>Net Only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="both"
                checked={format === 'both'}
                onChange={(e) => setFormat(e.target.value)}
                className="w-4 h-4 text-green-600"
              />
              <span>Gross & Net</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="stableford"
                checked={format === 'stableford'}
                onChange={(e) => setFormat(e.target.value)}
                className="w-4 h-4 text-green-600"
              />
              <span>Stableford</span>
            </label>
          </div>
        </div>

        {/* Skins Competition */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Skins Competition</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skinsEnabled}
                onChange={(e) => setSkinsEnabled(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded"
              />
              <span className="font-medium">Enable Skins Competition</span>
            </label>
            
            {skinsEnabled && (
              <div className="ml-6 space-y-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buy-in Amount ($)
                  </label>
                  <input
                    type="number"
                    value={skinsBuyIn}
                    onChange={(e) => setSkinsBuyIn(parseInt(e.target.value) || 10)}
                    min="1"
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skins Scoring Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="gross"
                        checked={skinsType === 'gross'}
                        onChange={(e) => setSkinsType(e.target.value)}
                        className="w-4 h-4 text-green-600"
                      />
                      <span>Gross Skins</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="net"
                        checked={skinsType === 'net'}
                        onChange={(e) => setSkinsType(e.target.value)}
                        className="w-4 h-4 text-green-600"
                      />
                      <span>Net Skins</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={skinsCarryover}
                      onChange={(e) => setSkinsCarryover(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <span className="font-medium">Enable Carryover</span>
                  </label>
                  <p className="text-sm text-gray-600 ml-6 mt-1">
                    When enabled, tied holes carry over to the next hole
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Load Saved Course */}
        {savedCourses.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Load Saved Course</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedCourses.map(course => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => loadCourse(course)}
                  className="flex items-center gap-2 p-4 border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 rounded-lg transition-colors text-left"
                >
                  <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{course.name}</div>
                    <div className="text-sm text-gray-600">
                      Par {course.course_par.reduce((a: number, b: number) => a + b, 0)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Course Par */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Course Par</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Front 9 (Par: {frontNinePar})</h4>
              <div className="grid grid-cols-9 gap-2">
                {coursePar.slice(0, 9).map((par, index) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-600 mb-1 text-center">
                      {index + 1}
                    </label>
                    <input
                      type="number"
                      value={par}
                      onChange={(e) => updateHolePar(index, e.target.value)}
                      min="3"
                      max="5"
                      className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Back 9 (Par: {backNinePar})</h4>
              <div className="grid grid-cols-9 gap-2">
                {coursePar.slice(9, 18).map((par, index) => (
                  <div key={index + 9}>
                    <label className="block text-xs text-gray-600 mb-1 text-center">
                      {index + 10}
                    </label>
                    <input
                      type="number"
                      value={par}
                      onChange={(e) => updateHolePar(index + 9, e.target.value)}
                      min="3"
                      max="5"
                      className="w-full px-2 py-2 border border-gray-300 rounded text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-lg font-semibold">
                Total Par: {totalPar}
              </div>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Display Settings</h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showHandicaps}
                onChange={(e) => setShowHandicaps(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded"
              />
              <span>Show player handicaps publicly</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showQuotas}
                onChange={(e) => setShowQuotas(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded"
              />
              <span>Show quotas (for Stableford)</span>
            </label>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-4" />
            {loading ? 'Saving...' : isEditing ? 'Update Tournament' : 'Create Tournament'}
          </button>
        </div>
      </form>
    </div>
  );
}