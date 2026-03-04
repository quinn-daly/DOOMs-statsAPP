import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllGames, getAllRosters, createGame, deleteGame, duplicateGame } from '../db';
import type { Game, Roster } from '../types';

export default function GamesPage() {
  const nav = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', dateTime: '', tournament: '', opponent: '', rosterId: 0, notes: '' });

  const load = useCallback(async () => {
    const [g, r] = await Promise.all([getAllGames(), getAllRosters()]);
    setGames(g);
    setRosters(r);
    if (r.length > 0 && form.rosterId === 0) {
      setForm(f => ({ ...f, rosterId: r[0].id! }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.rosterId) return;
    const id = await createGame({
      title: form.title.trim(),
      dateTime: form.dateTime || new Date().toISOString(),
      tournament: form.tournament.trim(),
      opponent: form.opponent.trim(),
      rosterId: form.rosterId,
      notes: form.notes.trim(),
    });
    setShowNew(false);
    setForm({ title: '', dateTime: '', tournament: '', opponent: '', rosterId: rosters[0]?.id || 0, notes: '' });
    await load();
    nav('/game/' + id);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this game and all its events?')) {
      await deleteGame(id);
      await load();
    }
  };

  const handleDuplicate = async (id: number) => {
    await duplicateGame(id);
    await load();
  };

  const rosterName = (id: number) => rosters.find(r => r.id === id)?.name || '—';

  return (
    <div className="page">
      <div className="flex-between mb-16">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Games</h1>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Game</button>
      </div>

      {games.length === 0 && (
        <div className="empty-state">
          <h3>No games yet</h3>
          <p>Create a roster first, then start a new game.</p>
        </div>
      )}

      {games.map(g => (
        <div className="card" key={g.id}>
          <div className="card-title">{g.title}</div>
          <div className="card-meta">
            {g.opponent && <>vs {g.opponent} · </>}
            {g.tournament && <>{g.tournament} · </>}
            {rosterName(g.rosterId)} · {new Date(g.dateTime).toLocaleDateString()}
          </div>
          <div className="card-actions">
            <button className="btn btn-sm btn-primary" onClick={() => nav('/game/' + g.id)}>Tag</button>
            <button className="btn btn-sm" onClick={() => nav('/export/' + g.id)}>Export</button>
            <button className="btn btn-sm" onClick={() => handleDuplicate(g.id!)}>Duplicate</button>
            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id!)}>Delete</button>
          </div>
        </div>
      ))}

      {showNew && (
        <div className="modal-overlay modal-center" onClick={() => setShowNew(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h3>New Game</h3>
            {rosters.length === 0 ? (
              <div>
                <p className="text-muted mb-16">You need a roster first.</p>
                <button className="btn btn-primary btn-block" onClick={() => nav('/rosters')}>Create Roster</button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Pool Play Game 1" autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Opponent</label>
                  <input className="form-input" value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} placeholder="e.g. Sockeye" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tournament</label>
                  <input className="form-input" value={form.tournament} onChange={e => setForm({ ...form, tournament: e.target.value })} placeholder="e.g. Nationals 2025" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date/Time</label>
                  <input className="form-input" type="datetime-local" value={form.dateTime} onChange={e => setForm({ ...form, dateTime: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Roster</label>
                  <select className="form-select" value={form.rosterId} onChange={e => setForm({ ...form, rosterId: Number(e.target.value) })}>
                    {rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="optional" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>Create & Tag</button>
                  <button className="btn" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
