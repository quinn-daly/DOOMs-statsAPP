import { Routes, Route, NavLink } from 'react-router-dom';
import GamesPage from './pages/GamesPage';
import RostersPage from './pages/RostersPage';
import TagGamePage from './pages/TagGamePage';
import ExportPage from './pages/ExportPage';

function App() {
  return (
    <>
      <nav className="top-nav">
        <span className="logo">⚡ TAGGER</span>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Games</NavLink>
        <NavLink to="/rosters" className={({ isActive }) => isActive ? 'active' : ''}>Rosters</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<GamesPage />} />
        <Route path="/rosters" element={<RostersPage />} />
        <Route path="/game/:id" element={<TagGamePage />} />
        <Route path="/export/:id" element={<ExportPage />} />
      </Routes>
    </>
  );
}

export default App;
