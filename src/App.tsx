import { Routes, Route, NavLink } from 'react-router-dom';
import { NavLogoLockup } from './DoomLogo';
import GamesPage from './pages/GamesPage';
import RostersPage from './pages/RostersPage';
import TagGamePage from './pages/TagGamePage';
import ExportPage from './pages/ExportPage';

function App() {
  return (
    <div className="app-shell">
      <nav className="nav-bar">
        <NavLink to="/" className="nav-logo">
          <NavLogoLockup />
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Games</NavLink>
          <NavLink to="/rosters" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Rosters</NavLink>
        </div>
      </nav>

      <div className="page-content">
        <Routes>
          <Route path="/" element={<GamesPage />} />
          <Route path="/rosters" element={<RostersPage />} />
          <Route path="/game/:id" element={<TagGamePage />} />
          <Route path="/export/:id" element={<ExportPage />} />
        </Routes>
      </div>

      <nav className="tab-bar">
        <NavLink to="/" end className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <span className="tab-label">Games</span>
        </NavLink>
        <NavLink to="/rosters" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <span className="tab-label">Rosters</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default App;
