import { useState, useEffect, useCallback } from 'react';
import { getAllRosters, createRoster, updateRoster, deleteRoster, getPlayersForRoster, createPlayer, updatePlayer, deletePlayer } from '../db';
import type { Roster, Player, LineRole } from '../types';
import { LINE_ROLES, playerLabel } from '../types';

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newRosterName, setNewRosterName] = useState('');
  const [editingRoster, setEditingRoster] = useState<number | null>(null);
  const [editRosterName, setEditRosterName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState({ name: '', number: '', lineRole: 'Both' as LineRole });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const loadRosters = useCallback(async () => {
    const r = await getAllRosters();
    setRosters(r);
  }, []);

  const loadPlayers = useCallback(async () => {
    if (selectedRosterId) {
      const p = await getPlayersForRoster(selectedRosterId);
      p.sort((a, b) => {
        const na = parseInt(a.number) || 999;
        const nb = parseInt(b.number) || 999;
        return na - nb;
      });
      setPlayers(p);
    } else {
      setPlayers([]);
    }
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
    await createPlayer({
      rosterId: selectedRosterId,
      name: playerForm.name.trim(),
      number: playerForm.number.trim(),
      lineRole: playerForm.lineRole,
      active: true,
    });
    setPlayerForm({ name: '', number: '', lineRole: 'Both' });
    setShowAddPlayer(false);
    await loadPlayers();
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    await updatePlayer(editingPlayer.id!, {
      name: editingPlayer.name,
      number: editingPlayer.number,
      lineRole: editingPlayer.lineRole,
      active: editingPlayer.active,
    });
    setEditingPlayer(null);
    await loadPlayers();
  };

  const handleDeletePlayer = async (id: number) => {
    if (confirm('Delete this player?')) {
      await deletePlayer(id);
      await loadPlayers();
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Rosters</h1>

      {/* Add Roster */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          value={newRosterName}
          onChange={e => setNewRosterName(e.target.value)}
          placeholder="New roster name..."
          onKeyDown={e => e.key === 'Enter' && handleAddRoster()}
        />
        <button className="btn btn-primary" onClick={handleAddRoster}>Add</button>
      </div>

      {/* Roster Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {rosters.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: 2 }}>
            {editingRoster === r.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="form-input" style={{ width: 120 }} value={editRosterName} onChange={e => setEditRosterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateRoster(r.id!)} autoFocus />
                <button className="btn btn-sm" onClick={() => handleUpdateRoster(r.id!)}>✓</button>
                <button className="btn btn-sm" onClick={() => setEditingRoster(null)}>✕</button>
              </div>
            ) : (
              <button
                className={`btn btn-sm ${selectedRosterId === r.id ? 'btn-primary' : ''}`}
                onClick={() => setSelectedRosterId(r.id!)}
                onDoubleClick={() => { setEditingRoster(r.id!); setEditRosterName(r.name); }}
              >
                {r.name}
              </button>
            )}
          </div>
        ))}
      </div>

      {selectedRosterId && (
        <>
          <div className="flex-between mb-8">
            <span className="text-muted text-sm">{players.length} players · double-tap roster name to rename</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddPlayer(true)}>+ Player</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRoster(selectedRosterId)}>Delete Roster</button>
            </div>
          </div>

          {players.length === 0 && (
            <div className="empty-state">
              <h3>No players</h3>
              <p>Add players to this roster.</p>
            </div>
          )}

          {players.map(p => (
            <div className="card" key={p.id} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{playerLabel(p)}</span>
                <span className="text-muted text-sm" style={{ marginLeft: 8 }}>({p.lineRole})</span>
                {!p.active && <span className="text-muted text-sm" style={{ marginLeft: 6 }}>· inactive</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setEditingPlayer({ ...p })}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDeletePlayer(p.id!)}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal-overlay modal-center" onClick={() => setShowAddPlayer(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h3>Add Player</h3>
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
              <div style={{ display: 'flex', gap: 6 }}>
                {LINE_ROLES.map(lr => (
                  <button key={lr} className={`tag-btn ${playerForm.lineRole === lr ? 'selected' : ''}`} style={{ flex: 1 }} onClick={() => setPlayerForm({ ...playerForm, lineRole: lr })}>{lr}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddPlayer}>Add Player</button>
              <button className="btn" onClick={() => setShowAddPlayer(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="modal-overlay modal-center" onClick={() => setEditingPlayer(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h3>Edit Player</h3>
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
              <div style={{ display: 'flex', gap: 6 }}>
                {LINE_ROLES.map(lr => (
                  <button key={lr} className={`tag-btn ${editingPlayer.lineRole === lr ? 'selected' : ''}`} style={{ flex: 1 }} onClick={() => setEditingPlayer({ ...editingPlayer, lineRole: lr })}>{lr}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Active</label>
              <button className={`tag-btn ${editingPlayer.active ? 'selected' : ''}`} onClick={() => setEditingPlayer({ ...editingPlayer, active: !editingPlayer.active })}>
                {editingPlayer.active ? 'Active ✓' : 'Inactive'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdatePlayer}>Save</button>
              <button className="btn" onClick={() => setEditingPlayer(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
