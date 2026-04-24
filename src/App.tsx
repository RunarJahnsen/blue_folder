import { Routes, Route } from 'react-router-dom';
import { GroupAccess } from './pages/GroupAccess';
import { PermList } from './pages/PermList';
import { PermNew } from './pages/PermNew';
import { PermView } from './pages/PermView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupAccess />} />
      <Route path="/:groupId" element={<PermList />} />
      <Route path="/:groupId/perms/new" element={<PermNew />} />
      <Route path="/:groupId/perms/:permId" element={<PermView />} />
    </Routes>
  );
}

export default App;
