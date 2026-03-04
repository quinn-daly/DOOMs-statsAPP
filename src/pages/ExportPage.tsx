import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { db, getGame, getPlayersForRoster, getEventsForGame } from '../db';
import type { Game, Player, GameEvent } from '../types';
import { playerLabel } from '../types';

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const gameId = Number(id);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const g = await getGame(gameId);
    if (!g) { nav('/'); return; }
    setGame(g);
    setPlayers(await getPlayersForRoster(g.rosterId));
    setEvents(await getEventsForGame(gameId));
  }, [gameId, nav]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const pName = (pid: number | null | undefined) => { if (!pid) return ''; const p = players.find(pl => pl.id === pid); return p ? playerLabel(p) : 'ID:' + pid; };
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

  const handleExportCSV = () => {
    if (!game) return;
    const rows = events.map(evt => ({ 'Game Title': game.title, 'Date/Time': game.dateTime, Tournament: game.tournament, Opponent: game.opponent, Seq: evt.seq, Action: evt.action, Passer: pName(evt.passerId), Receiver: pName(evt.receiverId), Defender: pName(evt.defenderId), 'Throw Type': evt.throwType || '', 'Throw Purpose': evt.throwPurpose || '', 'Turn Cause': evt.turnCause || '', 'Pressure Credit Player': pName(evt.pressureCreditPlayerId), 'Block Type': evt.blockType || '', 'Scored On Defender': pName(evt.scoredOnDefenderId) }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = sanitize(game.title) + '_' + new Date(game.dateTime).toISOString().split('T')[0] + '.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  };

  const handleBackupJSON = async () => {
    if (!game) return;
    const roster = await db.rosters.get(game.rosterId);
    const backup = { version: 1, exportedAt: new Date().toISOString(), roster, players: await getPlayersForRoster(game.rosterId), game, events };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = sanitize(game.title) + '_backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup downloaded');
  };

  const handleRestoreJSON = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!backup.game || !backup.events) { showToast('Invalid backup'); return; }
        await db.transaction('rw', db.rosters, db.players, db.games, db.events, async () => {
          let rosterId: number;
          if (backup.roster) { const ex = await db.rosters.get(backup.roster.id); if (ex) { await db.rosters.update(backup.roster.id, backup.roster); rosterId = backup.roster.id; } else { rosterId = await db.rosters.add(backup.roster); } } else { rosterId = await db.rosters.add({ name: 'Imported', createdAt: Date.now(), updatedAt: Date.now() }); }
          if (backup.players) { for (const p of backup.players) { p.rosterId = rosterId; const ex = await db.players.get(p.id); if (ex) await db.players.update(p.id, p); else await db.players.add(p); } }
          const gd = { ...backup.game, rosterId }; const ex = await db.games.get(gd.id); let gid: number; if (ex) { await db.games.update(gd.id, gd); gid = gd.id; } else { gid = await db.games.add(gd); }
          await db.events.where('gameId').equals(gid).delete();
          for (const evt of backup.events) { evt.gameId = gid; await db.events.add(evt); }
          showToast('Restored!'); nav('/game/' + gid);
        });
      } catch { showToast('Restore failed'); }
    };
    input.click();
  };

  if (!game) return <div className="page"><p className="text-muted">Loading...</p></div>;

  return (
    <div className="page">
      <div className="flex-between mb-16">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Export</h1>
        <button className="btn btn-sm" onClick={() => nav('/game/' + gameId)}>← Back to Tag</button>
      </div>
      <div className="card"><div className="card-title">{game.title}</div><div className="card-meta">{game.opponent && 'vs ' + game.opponent + ' · '}{events.length} events</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button className="btn btn-primary btn-block" onClick={handleExportCSV} style={{ padding: '16px 24px', fontSize: 16 }}>📊 Export CSV</button>
        <div className="text-muted text-sm text-center">Downloads a spreadsheet with all event data.</div>
        <div style={{ height: 16 }} />
        <button className="btn btn-block" onClick={handleBackupJSON} style={{ padding: '16px 24px', fontSize: 16 }}>💾 Backup JSON</button>
        <div className="text-muted text-sm text-center">Full backup including roster, players, game, and events.</div>
        <div style={{ height: 16 }} />
        <button className="btn btn-block" onClick={handleRestoreJSON} style={{ padding: '16px 24px', fontSize: 16 }}>📂 Restore from JSON</button>
        <div className="text-muted text-sm text-center">Import a backup file. Will merge with existing data.</div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
