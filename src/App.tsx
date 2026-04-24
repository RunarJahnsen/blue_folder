import { Routes, Route } from 'react-router-dom';
import { GroupAccess } from './pages/GroupAccess';
import { FolderList } from './pages/FolderList';
import { FolderNew } from './pages/FolderNew';
import { FolderView } from './pages/FolderView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupAccess />} />
      <Route path="/:groupId" element={<FolderList />} />
      <Route path="/:groupId/folders/new" element={<FolderNew />} />
      <Route path="/:groupId/folders/:folderId" element={<FolderView />} />
    </Routes>
  );
}

export default App;
