import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { RoundView } from './pages/RoundView';
import { Stats } from './pages/Stats';
import { History } from './pages/History';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProfileView } from './pages/ProfileView';

export default function App() {
  const { initialize, user, isLoading, isRecoveryMode } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user || isRecoveryMode) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="round" element={<RoundView />} />
          <Route path="stats" element={<Stats />} />
          <Route path="history" element={<History />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="profile" element={<ProfileView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
