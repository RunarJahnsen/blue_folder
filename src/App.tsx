import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { GroupSelect } from './pages/GroupSelect';
import { FolderList } from './pages/FolderList';
import { FolderNew } from './pages/FolderNew';
import { FolderView } from './pages/FolderView';
import { SongList } from './pages/SongList';
import { UserAdmin } from './pages/admin/UserAdmin';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/group-select"
        element={
          <ProtectedRoute>
            <GroupSelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:groupId"
        element={
          <ProtectedRoute>
            <FolderList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:groupId/songs"
        element={
          <ProtectedRoute>
            <SongList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:groupId/folders/new"
        element={
          <ProtectedRoute>
            <FolderNew />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:groupId/folders/:folderId"
        element={
          <ProtectedRoute>
            <FolderView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:groupId/admin/users"
        element={
          <ProtectedRoute>
            <UserAdmin />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
