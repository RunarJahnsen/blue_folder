import { Routes, Route } from 'react-router-dom';
import { GroupAccess } from './pages/GroupAccess';
import { FolderList } from './pages/FolderList';
import { FolderNew } from './pages/FolderNew';
import { FolderView } from './pages/FolderView';
import { SongList } from './pages/SongList';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupAccess />} />
      <Route path="/:groupId" element={<FolderList />} />
      <Route path="/:groupId/songs" element={<SongList />} />
      <Route path="/:groupId/folders/new" element={<FolderNew />} />
      <Route path="/:groupId/folders/:folderId" element={<FolderView />} />
    </Routes>
  );
}

export default App;
