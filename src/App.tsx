import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider as OldAuthProvider, useAuth as useOldAuth } from './lib/auth';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLogin from './pages/AdminLogin';
import PublicTournamentList from './pages/PublicTournamentList';
import TournamentList from './pages/TournamentList';
import TournamentSetup from './pages/TournamentSetup';
import PlayerManagement from './pages/PlayerManagement';
import FlightManagement from './pages/FlightManagement';
import GroupManagement from './pages/GroupManagement';
import ScoringInterface from './pages/ScoringInterface';
import AdminScoring from './pages/AdminScoring';
import Leaderboard from './pages/Leaderboard';
import SavedCourses from './pages/SavedCourses';
import SavedPlayers from './pages/SavedPlayers';
import UserManagement from './pages/UserManagement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/public" element={<PublicTournamentList />} />
      <Route path="/tournament/:id/leaderboard" element={<Leaderboard />} />
      <Route path="/tournament/:id/score" element={<ScoringInterface />} />
      
      <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<TournamentList />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="tournament/new" element={<TournamentSetup />} />
        <Route path="tournament/:id/edit" element={<TournamentSetup />} />
        <Route path="tournament/:id/players" element={<PlayerManagement />} />
        <Route path="tournament/:id/flights" element={<FlightManagement />} />
        <Route path="tournament/:id/groups" element={<GroupManagement />} />
        <Route path="tournament/:id/admin-score" element={<AdminScoring />} />
        <Route path="saved-courses" element={<SavedCourses />} />
        <Route path="saved-players" element={<SavedPlayers />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <OldAuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </OldAuthProvider>
    </AuthProvider>
  );
}

export default App;