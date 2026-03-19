import { useState, useEffect, useCallback } from 'react';
import { getAllRosters, createRoster, updateRoster, deleteRoster, getPlayersForRoster, createPlayer, updatePlayer, deletePlayer } from '../db';
import type { Roster, Player, LineRole } from '../types';
import { LINE_ROLES } from '../types';

const getInitials = (name: string) => {
  const words = name.split(' ').filter(w => !w.startsWith('('));
  return ((words[0]?.[0] || '') + (words[words.length - 1]?.[0] || '')).toUpperCase();
};

const byLastName = (a: Player, b: Player) => {
  const last = (n: string) => n.trim().split(' ').pop() || '';
  return last(a.name).localeCompare(last(b.name));
};

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newRosterName, setNewRosterName] = useState('');
  const [editingRoster, setEditingRoster] = useState<number | null>(null);
  const [editRosterName, setEditRosterName] = useState('');
  const [showManage, setShowManage] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState({ name: '', number: '', lineRole: 'Both' as LineRole });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const loadRosters = useCallback(async () => {
    const r = await getAllRosters();
    setRosters(r);
    setSelectedRosterId(prev => {
      if (prev !== null) return prev;
      const doom = r.find(roster => roster.seedKey === 'doom-seed');
      return doom?.id ?? r[0]?.id ?? null;
    });
  }, []);

  const loadPlayers = useCallback(async () => {
    if (selectedRosterId) {
      const p = await getPlayersForRoster(selectedRosterId);
      p.sort(byLastName);
      setPlayers(p);
    } else { setPlayers([]); }
  }, [selectedRosterId]);

  useEffect(() => { loadRosters(); }, [loadRosters]);
  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  const handleAddRoster = async () => {
    if (!newRosterName.trim()) return;
    const id = await createRoster(newRosterName.trim());
    setNewRosterName('');
    await loadRosters();
    setSelectedRosterId(id);
  };
  const handleUpdateRoster = async (id: number) => {
    if (!editRosterName.trim()) return;
    await updateRoster(id, editRosterName.trim());
    setEditingRoster(null);
    await loadRosters();
  };
  const handleDeleteRoster = async (id: number) => {
    if (confirm('Delete this roster, all its players, and associated games?')) {
      await deleteRoster(id);
      if (selectedRosterId === id) setSelectedRosterId(null);
      await loadRosters();
    }
  };
  const handleAddPlayer = async () => {
    if (!playerForm.name.trim() || !selectedRosterId) return;
    await createPlayer({ rosterId: selectedRosterId, name: playerForm.name.trim(), number: playerForm.number.trim(), lineRole: playerForm.lineRole, active: true });
    setPlayerForm({ name: '', number: '', lineRole: 'Both' });
    setShowAddPlayer(false);
    await loadPlayers();
  };
  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    await updatePlayer(editingPlayer.id!, { name: editingPlayer.name, number: editingPlayer.number, lineRole: editingPlayer.lineRole, active: editingPlayer.active });
    setEditingPlayer(null);
    await loadPlayers();
  };
  const handleDeletePlayer = async (id: number) => {
    if (confirm('Delete this player?')) { await deletePlayer(id); await loadPlayers(); }
  };

  const selectedRoster = rosters.find(r => r.id === selectedRosterId);
  const isDoomRoster = selectedRoster?.seedKey === 'doom-seed';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rosters</h1>
      </div>

      {/* Roster tabs + manage toggle */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {rosters.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 2 }}>
            {editingRoster === r.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  className="form-input"
                  style={{ width: 120, minHeight: 36, padding: '6px 10px' }}
                  value={editRosterName}
                  onChange={e => setEditRosterName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUpdateRoster(r.id!)}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={() => handleUpdateRoster(r.id!)}>✓</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditingRoster(null)}>✕</button>
              </div>
            ) : (
              <button
                className={`btn btn-sm ${selectedRosterId === r.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedRosterId(r.id!)}
                onDoubleClick={() => { setEditingRoster(r.id!); setEditRosterName(r.name); }}
              >
                {r.name}
              </button>
            )}
          </div>
        ))}
        <button
          className="btn btn-sm btn-ghost"
          style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 12 }}
          onClick={() => setShowManage(!showManage)}
        >
          {showManage ? 'Done' : '⚙ Manage'}
        </button>
      </div>

      {/* Manage Rosters section */}
      {showManage && (
        <div className="card mb-3" style={{ padding: '12px 14px' }}>
          <div className="label-mono mb-2">Add Roster</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: selectedRosterId && !isDoomRoster ? 10 : 0 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={newRosterName}
              onChange={e => setNewRosterName(e.target.value)}
              placeholder="New roster name..."
              onKeyDown={e => e.key === 'Enter' && handleAddRoster()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddRoster}>Add</button>
          </div>
          {selectedRosterId && !isDoomRoster && (
            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRoster(selectedRosterId)}>
              Delete "{selectedRoster?.name}"
            </button>
          )}
        </div>
      )}

      {selectedRosterId && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="label-mono">{players.length} players</span>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddPlayer(true)}>+ Player</button>
          </div>

          {players.length === 0 && (
            <div className="empty-state">
              <div>No players</div>
              <div style={{ marginTop: 8 }}>Add players to this roster.</div>
            </div>
          )}

          <div className="card-list">
            {players.map(p => {
              const initials = getInitials(p.name);
              return (
                <div className="card card-row" key={p.id} style={{ padding: '4px 14px', minHeight: 48, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {p.avatarFile
                      ? <img src={`/DOOMs-statsAPP/avatars/${p.avatarFile}`} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={p.name} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--doom-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--doom-bone)', flexShrink: 0 }}>{initials}</div>
                    }
                    <div>
                      {p.number && <span style={{ color: 'var(--page-accent)', fontFamily: "'Share Tech Mono', monospace", fontSize: 13 }}>#{p.number} </span>}
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--doom-bone)' }}>{p.name}</span>
                      {!p.active && <span className="text-muted text-sm" style={{ marginLeft: 6 }}>· inactive</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingPlayer({ ...p })}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePlayer(p.id!)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal-overlay" onClick={() => setShowAddPlayer(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Player</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={playerForm.name} onChange={e => setPlayerForm({ ...playerForm, name: e.target.value })} placeholder="Player name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Number</label>
              <input className="form-input" value={playerForm.number} onChange={e => setPlayerForm({ ...playerForm, number: e.target.value })} placeholder="#" />
            </div>
            <div className="form-group">
              <label className="form-label">Line Role</label>
              <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
                {LINE_ROLES.map(lr => (
                  <button key={lr} className={`option-btn${playerForm.lineRole === lr ? ' selected' : ''}`} onClick={() => setPlayerForm({ ...playerForm, lineRole: lr })}>{lr}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddPlayer}>Add Player</button>
              <button className="btn btn-ghost" onClick={() => setShowAddPlayer(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="modal-overlay" onClick={() => setEditingPlayer(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Player</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={editingPlayer.name} onChange={e => setEditingPlayer({ ...editingPlayer, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Number</label>
              <input className="form-input" value={editingPlayer.number} onChange={e => setEditingPlayer({ ...editingPlayer, number: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Line Role</label>
              <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
                {LINE_ROLES.map(lr => (
                  <button key={lr} className={`option-btn${editingPlayer.lineRole === lr ? ' selected' : ''}`} onClick={() => setEditingPlayer({ ...editingPlayer, lineRole: lr })}>{lr}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <button className={`option-btn${editingPlayer.active ? ' selected' : ''}`} onClick={() => setEditingPlayer({ ...editingPlayer, active: !editingPlayer.active })}>
                {editingPlayer.active ? 'Active ✓' : 'Inactive'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdatePlayer}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditingPlayer(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
