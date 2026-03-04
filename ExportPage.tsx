import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { db, getGame, getPlayersForRoster, getEventsForGame, getAllRosters } from '../db';
import type { Game, Player, GameEvent, Roster } from '../types';
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
    const p = await getPlayersForRoster(g.rosterId);
    setPlayers(p);
    const evts = await getEventsForGame(gameId);
    setEvents(evts);
  }, [gameId, nav]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const pName = (pid: number | null | undefined) => {
    if (!pid) return '';
    const p = players.find(pl => pl.id === pid);
    return p ? playerLabel(p) : `ID:${pid}`;
  };

  const sanitizeFilename = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

  // ── CSV Export ──
  const handleExportCSV = () => {
    if (!game) return;
    const rows = events.map(evt => ({
      'Game Title': game.title,
      'Date/Time': game.dateTime,
      'Tournament': game.tournament,
      'Opponent': game.opponent,
      'Seq': evt.seq,
      'Action': evt.action,
      'Passer': pName(evt.passerId),
      'Receiver': pName(evt.receiverId),
      'Defender': pName(evt.defenderId),
      'Throw Type': evt.throwType || '',
      'Throw Purpose': evt.throwPurpose || '',
      'Turn Cause': evt.turnCause || '',
      'Pressure Credit Player': pName(evt.pressureCreditPlayerId),
      'Block Type': evt.blockType || '',
      'Scored On Defender': pName(evt.scoredOnDefenderId),
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date(game.dateTime).toISOString().split('T')[0];
    a.href = url;
    a.download = `${sanitizeFilename(game.title)}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  };

  // ── JSON Backup ──
  const handleBackupJSON = async () => {
    if (!game) return;
    const roster = await db.rosters.get(game.rosterId);
    const allPlayers = await getPlayersForRoster(game.rosterId);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      roster: roster || null,
      players: allPlayers,
      game: game,
      events: events,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date(game.dateTime).toISOString().split('T')[0];
    a.href = url;
    a.download = `${sanitizeFilename(game.title)}_${dateStr}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup downloaded');
  };

  // ── JSON Restore ──
  const handleRestoreJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.game || !backup.events) {
          showToast('Invalid backup file');
          return;
        }

        await db.transaction('rw', db.rosters, db.players, db.games, db.events, async () => {
          // Upsert roster
          let rosterId: number;
          if (backup.roster) {
            const existingRoster = await db.rosters.get(backup.roster.id);
            if (existingRoster) {
              await db.rosters.update(backup.roster.id, backup.roster);
              rosterId = backup.roster.id;
            } else {
              rosterId = await db.rosters.add(backup.roster);
            }
          } else {
            // Create a default roster
            const now = Date.now();
            rosterId = await db.rosters.add({ name: 'Imported Roster', createdAt: now, updatedAt: now });
          }

          // Upsert players
          if (backup.players) {
            for (const player of backup.players) {
              player.rosterId = rosterId;
              const existing = await db.players.get(player.id);
              if (existing) {
                await db.players.update(player.id, player);
              } else {
                await db.players.add(player);
              }
            }
          }

          // Upsert game
          const gameData = { ...backup.game, rosterId };
          const existingGame = await db.games.get(gameData.id);
          let restoredGameId: number;
          if (existingGame) {
            await db.games.update(gameData.id, gameData);
            restoredGameId = gameData.id;
          } else {
            restoredGameId = await db.games.add(gameData);
          }

          // Clear and re-add events
          await db.events.where('gameId').equals(restoredGameId).delete();
          for (const evt of backup.events) {
            evt.gameId = restoredGameId;
            await db.events.add(evt);
          }

          showToast('Restored!');
          nav(`/game/${restoredGameId}`);
        });
      } catch (err) {
        console.error(err);
        showToast('Restore failed');
      }
    };
    input.click();
  };

  if (!game) return <div className="page"><p className="text-muted">Loading...</p></div>;

  return (
    <div className="page">
      <div className="flex-between mb-16">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Export</h1>
        <button className="btn btn-sm" onClick={() => nav(`/game/${gameId}`)}>← Back to Tag</button>
      </div>

      <div className="card">
        <div className="card-title">{game.title}</div>
        <div className="card-meta">
          {game.opponent && `vs ${game.opponent} · `}
          {events.length} events · {new Date(game.dateTime).toLocaleDateString()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button className="btn btn-primary btn-block" onClick={handleExportCSV} style={{ padding: '16px 24px', fontSize: 16 }}>
          📊 Export CSV
        </button>
        <div className="text-muted text-sm text-center">
          Downloads a spreadsheet with all event data. Open in Excel/Sheets.
        </div>

        <div style={{ height: 16 }} />

        <button className="btn btn-block" onClick={handleBackupJSON} style={{ padding: '16px 24px', fontSize: 16 }}>
          💾 Backup JSON
        </button>
        <div className="text-muted text-sm text-center">
          Full backup including roster, players, game, and events. Use to transfer between devices.
        </div>

        <div style={{ height: 16 }} />

        <button className="btn btn-block" onClick={handleRestoreJSON} style={{ padding: '16px 24px', fontSize: 16 }}>
          📂 Restore from JSON
        </button>
        <div className="text-muted text-sm text-center">
          Import a backup file. Will merge with existing data.
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
