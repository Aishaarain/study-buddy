import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import Upload from './pages/Upload';
import Quiz from './pages/Quiz';
import Planner from './pages/Planner';
import Chat from './pages/Chat';
import FlashCards from './pages/Flashcards';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/layout/Sidebar';

function ProtectedLayout({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050510] text-[#e8e0ff]">
        Loading...
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#050510]">
      <Sidebar />

      <main className="flex-1 overflow-auto bg-[#050510]">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/landing" element={<LandingPage />} />

      <Route path="/upload" element={<ProtectedLayout><Upload /></ProtectedLayout>} />
      <Route path="/quiz" element={<ProtectedLayout><Quiz /></ProtectedLayout>} />
      <Route path="/planner" element={<ProtectedLayout><Planner /></ProtectedLayout>} />
      <Route path="/chat" element={<ProtectedLayout><Chat /></ProtectedLayout>} />
      <Route path="/flashcards" element={<ProtectedLayout><FlashCards /></ProtectedLayout>} />
      <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a0a3a',
              color: '#e8e0ff',
              border: '1px solid rgba(124,92,252,0.3)',
            },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}