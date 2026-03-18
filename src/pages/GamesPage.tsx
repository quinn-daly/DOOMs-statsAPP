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
    <div>
      <div className="page-header">
        <h1 className="page-title">Games</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>+ New Game</button>
      </div>

      {games.length === 0 && (
        <div className="empty-state">
          <div>No games yet</div>
          <div style={{ marginTop: 8 }}>Create a roster first, then start a new game.</div>
        </div>
      )}

      <div className="card-list">
        {games.map(g => (
          <div className="card card-accent" key={g.id}>
            <div className="font-doom" style={{ fontSize: '1.2rem', marginBottom: 4 }}>{g.title}</div>
            <div className="label-mono mb-3">
              {g.opponent && <>vs {g.opponent} · </>}
              {g.tournament && <>{g.tournament} · </>}
              {rosterName(g.rosterId)} · {new Date(g.dateTime).toLocaleDateString()}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary" onClick={() => nav('/game/' + g.id)}>Tag</button>
              <button className="btn btn-sm btn-ghost" onClick={() => nav('/export/' + g.id)}>Export</button>
              <button className="btn btn-sm btn-ghost" onClick={() => handleDuplicate(g.id!)}>Duplicate</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id!)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Game</div>
            {rosters.length === 0 ? (
              <div>
                <p className="text-muted mb-4">You need a roster first.</p>
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
                  <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
