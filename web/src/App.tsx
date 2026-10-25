import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, type User } from './lib/api';
import EditorPage from './pages/Editor';
import LibraryPage from './pages/Library';
import LoginPage from './pages/Login';
import ViewPage from './pages/View';
import SharedPage from './pages/Shared';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <Routes>
      <Route path="/s/:token" element={<SharedPage />} />
      {user === undefined ? (
        <Route path="*" element={<div className="center-page">Loading…</div>} />
      ) : user === null ? (
        <Route path="*" element={<LoginPage onAuth={setUser} />} />
      ) : (
        <>
          <Route path="/" element={<LibraryPage user={user} onLogout={() => api.logout().then(() => setUser(null))} />} />
          <Route path="/drill/:id" element={<EditorPage />} />
          <Route path="/drill/:id/view" element={<ViewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}
