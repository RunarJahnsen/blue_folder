import { Routes, Route } from 'react-router-dom';
import { GroupAccess } from './pages/GroupAccess';
import { RoomList } from './pages/RoomList';
import { RoomNew } from './pages/RoomNew';
import { RoomView } from './pages/RoomView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupAccess />} />
      <Route path="/:groupId" element={<RoomList />} />
      <Route path="/:groupId/rooms/new" element={<RoomNew />} />
      <Route path="/:groupId/rooms/:roomId" element={<RoomView />} />
    </Routes>
  );
}

export default App;
