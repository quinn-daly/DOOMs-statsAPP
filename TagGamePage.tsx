import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGame, getPlayersForRoster, getEventsForGame, getNextSeq, addEvent, updateEvent, deleteLastEvent } from '../db';
import type {
  Game, Player, GameEvent, Action, ThrowType, ThrowPurpose, TurnCause, BlockType,
} from '../types';
import {
  THROW_TYPES, THROW_PURPOSES, TURN_CAUSES, BLOCK_TYPES,
  playerLabel, actionNeedsThrow, actionNeedsTurnCause, actionNeedsBlockType,
  actionNeedsReceiver, actionNeedsDefender,
} from '../types';

interface DiscState {
  lastHolderId: number | null;
  prevHolderId: number | null;
}

export default function TagGamePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const gameId = Number(id);

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [disc, setDisc] = useState<DiscState>({ lastHolderId: null, prevHolderId: null });

  // Sticky defaults for throw type/purpose
  const [stickyThrow, setStickyThrow] = useState<ThrowType | null>(null);
  const [stickyPurpose, setStickyPurpose] = useState<ThrowPurpose | null>(null);

  // Bottom sheet state
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [sheetData, setSheetData] = useState<Partial<GameEvent>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);

  const eventListRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const g = await getGame(gameId);
    if (!g) { nav('/'); return; }
    setGame(g);
    const p = await getPlayersForRoster(g.rosterId);
    p.sort((a, b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
    setPlayers(p.filter(pl => pl.active));
    const evts = await getEventsForGame(gameId);
    setEvents(evts);
    // Reconstruct disc state from events
    rebuildDiscState(evts);
  }, [gameId, nav]);

  useEffect(() => { load(); }, [load]);

  const rebuildDiscState = (evts: GameEvent[]) => {
    let last: number | null = null;
    let prev: number | null = null;
    for (const evt of evts) {
      if (evt.action === 'Catch' || evt.action === 'Goal') {
        prev = evt.passerId || null;
        last = evt.receiverId || null;
      } else if (evt.action === 'Throwaway' || evt.action === 'Drop') {
        last = null; prev = null;
      } else if (evt.action === 'D' || evt.action === 'Pull' || evt.action === 'Callahan') {
        last = null; prev = null;
      }
    }
    setDisc({ lastHolderId: last, prevHolderId: prev });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  // ── Action button pressed ──
  const handleAction = (action: Action) => {
    const data: Partial<GameEvent> = { action };

    // Auto-fill passer from disc state
    if (actionNeedsThrow(action) && disc.lastHolderId) {
      data.passerId = disc.lastHolderId;
    }

    // Apply sticky defaults
    if (actionNeedsThrow(action)) {
      if (stickyThrow) data.throwType = stickyThrow;
      if (stickyPurpose) data.throwPurpose = stickyPurpose;
    }

    // For Pull, just open sheet for defender selection
    if (action === 'Pull') {
      data.passerId = null;
      data.receiverId = null;
    }

    setPendingAction(action);
    setSheetData(data);
  };

  // ── Save event from sheet ──
  const handleSaveEvent = async () => {
    if (!pendingAction) return;

    // Validation
    if (actionNeedsReceiver(pendingAction) && !sheetData.receiverId) {
      showToast('Select a receiver'); return;
    }
    if (actionNeedsDefender(pendingAction) && !sheetData.defenderId) {
      showToast('Select a defender'); return;
    }
    if (actionNeedsThrow(pendingAction) && !sheetData.throwType) {
      showToast('Select throw type'); return;
    }
    if (actionNeedsThrow(pendingAction) && !sheetData.throwPurpose) {
      showToast('Select throw purpose'); return;
    }
    if (actionNeedsTurnCause(pendingAction) && !sheetData.turnCause) {
      showToast('Select turn cause'); return;
    }
    if (actionNeedsBlockType(pendingAction) && !sheetData.blockType) {
      showToast('Select block type'); return;
    }
    if (actionNeedsTurnCause(pendingAction) && sheetData.turnCause !== 'Unforced' && !sheetData.pressureCreditPlayerId) {
      showToast('Select pressure credit player'); return;
    }

    // For Callahan, receiver is the defender (they score it)
    if (pendingAction === 'Callahan') {
      sheetData.receiverId = sheetData.defenderId;
    }

    if (editingEvent) {
      // Update existing
      await updateEvent(editingEvent.id!, sheetData);
    } else {
      // New event
      const seq = await getNextSeq(gameId);
      await addEvent({
        gameId,
        seq,
        timestamp: Date.now(),
        action: pendingAction,
        passerId: sheetData.passerId || null,
        receiverId: sheetData.receiverId || null,
        defenderId: sheetData.defenderId || null,
        throwType: sheetData.throwType || null,
        throwPurpose: sheetData.throwPurpose || null,
        turnCause: sheetData.turnCause || null,
        pressureCreditPlayerId: sheetData.pressureCreditPlayerId || null,
        blockType: sheetData.blockType || null,
        scoredOnDefenderId: sheetData.scoredOnDefenderId || null,
      });
    }

    // Update sticky defaults
    if (sheetData.throwType) setStickyThrow(sheetData.throwType);
    if (sheetData.throwPurpose) setStickyPurpose(sheetData.throwPurpose);

    setPendingAction(null);
    setSheetData({});
    setEditingEvent(null);
    await load();
    showToast('Saved ✓');
  };

  // ── Undo ──
  const handleUndo = async () => {
    if (events.length === 0) return;
    if (confirm('Undo last event?')) {
      await deleteLastEvent(gameId);
      await load();
      showToast('Undone');
    }
  };

  // ── Edit event ──
  const handleEditEvent = (evt: GameEvent) => {
    setEditingEvent(evt);
    setPendingAction(evt.action);
    setSheetData({ ...evt });
  };

  // ── Player lookup ──
  const playerById = (pid: number | null | undefined) => {
    if (!pid) return null;
    return players.find(p => p.id === pid) || null;
  };

  const playerName = (pid: number | null | undefined) => {
    const p = playerById(pid);
    return p ? playerLabel(p) : '?';
  };

  const discHolderName = disc.lastHolderId ? playerName(disc.lastHolderId) : 'Nobody';

  // ── Event description ──
  const describeEvent = (evt: GameEvent): string => {
    const parts: string[] = [];
    switch (evt.action) {
      case 'Catch':
        parts.push(`${playerName(evt.passerId)} → ${playerName(evt.receiverId)}`);
        break;
      case 'Goal':
        parts.push(`${playerName(evt.passerId)} → ${playerName(evt.receiverId)} GOAL`);
        break;
      case 'Throwaway':
        parts.push(`${playerName(evt.passerId)} turnover`);
        break;
      case 'Drop':
        parts.push(`${playerName(evt.receiverId)} drop from ${playerName(evt.passerId)}`);
        break;
      case 'D':
        parts.push(`D by ${playerName(evt.defenderId)}`);
        break;
      case 'Callahan':
        parts.push(`Callahan by ${playerName(evt.defenderId)}`);
        break;
      case 'Pull':
        parts.push(`Pull by ${playerName(evt.defenderId)}`);
        break;
    }
    if (evt.throwType) parts.push(evt.throwType);
    if (evt.throwPurpose) parts.push(evt.throwPurpose);
    if (evt.turnCause) parts.push(evt.turnCause);
    if (evt.blockType) parts.push(evt.blockType);
    return parts.join(' · ');
  };

  if (!game) return <div className="page"><p className="text-muted">Loading...</p></div>;

  const reversedEvents = [...events].reverse().slice(0, 20);

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Game header */}
      <div className="flex-between mb-8">
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>{game.title}</div>
          <div className="text-muted text-sm">{game.opponent && `vs ${game.opponent}`} {game.tournament && `· ${game.tournament}`}</div>
        </div>
        <button className="btn btn-sm" onClick={() => nav(`/export/${gameId}`)}>Export</button>
      </div>

      {/* Disc state indicator */}
      <div className="disc-state">
        <span className="disc-icon">🥏</span>
        <span>Disc: </span>
        <span className="disc-holder">{discHolderName}</span>
        {disc.prevHolderId && <span className="text-muted text-sm">(from {playerName(disc.prevHolderId)})</span>}
      </div>

      {/* Action buttons */}
      <div className="action-grid">
        <button className="action-btn catch" onClick={() => handleAction('Catch')}>Catch</button>
        <button className="action-btn goal" onClick={() => handleAction('Goal')}>Goal</button>
        <button className="action-btn throwaway" onClick={() => handleAction('Throwaway')}>T/A</button>
        <button className="action-btn drop" onClick={() => handleAction('Drop')}>Drop</button>
        <button className="action-btn d-action" onClick={() => handleAction('D')}>D</button>
        <button className="action-btn callahan" onClick={() => handleAction('Callahan')}>Callahan</button>
        <button className="action-btn pull" onClick={() => handleAction('Pull')}>Pull</button>
        <button className="action-btn undo" onClick={handleUndo}>Undo ↩</button>
      </div>

      {/* Event feed */}
      <div className="text-muted text-sm mb-8" style={{ fontFamily: 'var(--font-display)' }}>
        {events.length} EVENTS
      </div>
      <div ref={eventListRef}>
        <ul className="event-list">
          {reversedEvents.map(evt => (
            <li className="event-item" key={evt.id} onClick={() => handleEditEvent(evt)}>
              <span className="event-seq">{evt.seq}</span>
              <span className={`event-action-badge ${evt.action.toLowerCase().replace('/', '-')}`}>
                {evt.action}
              </span>
              <span className="event-detail">{describeEvent(evt)}</span>
            </li>
          ))}
        </ul>
        {events.length === 0 && (
          <div className="empty-state">
            <h3>Ready to tag</h3>
            <p>Tap an action button to start logging events.</p>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet ── */}
      {pendingAction && (
        <div className="modal-overlay" onClick={() => { setPendingAction(null); setEditingEvent(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h3>{editingEvent ? 'Edit' : 'Log'} {pendingAction}</h3>

            {/* Passer override */}
            {actionNeedsThrow(pendingAction) && (
              <>
                <div className="section-label">Thrower (Passer)</div>
                <div className="player-picker">
                  {players.map(p => (
                    <button
                      key={p.id}
                      className={`player-pick-btn ${sheetData.passerId === p.id ? 'selected' : ''}`}
                      onClick={() => setSheetData({ ...sheetData, passerId: p.id })}
                    >
                      {playerLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Receiver */}
            {actionNeedsReceiver(pendingAction) && (
              <>
                <div className="section-label">Receiver *</div>
                <div className="player-picker">
                  {players.map(p => (
                    <button
                      key={p.id}
                      className={`player-pick-btn ${sheetData.receiverId === p.id ? 'selected' : ''}`}
                      onClick={() => setSheetData({ ...sheetData, receiverId: p.id })}
                    >
                      {playerLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Defender */}
            {(actionNeedsDefender(pendingAction) || pendingAction === 'Pull') && (
              <>
                <div className="section-label">{pendingAction === 'Pull' ? 'Puller' : 'Defender'} *</div>
                <div className="player-picker">
                  {players.map(p => (
                    <button
                      key={p.id}
                      className={`player-pick-btn ${sheetData.defenderId === p.id ? 'selected' : ''}`}
                      onClick={() => setSheetData({ ...sheetData, defenderId: p.id })}
                    >
                      {playerLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Throw Type */}
            {actionNeedsThrow(pendingAction) && (
              <>
                <div className="section-label">Throw Type *</div>
                <div className="tag-grid">
                  {THROW_TYPES.map(tt => (
                    <button key={tt} className={`tag-btn ${sheetData.throwType === tt ? 'selected' : ''}`} onClick={() => setSheetData({ ...sheetData, throwType: tt })}>{tt}</button>
                  ))}
                </div>
              </>
            )}

            {/* Throw Purpose */}
            {actionNeedsThrow(pendingAction) && (
              <>
                <div className="section-label">Throw Purpose *</div>
                <div className="tag-grid">
                  {THROW_PURPOSES.map(tp => (
                    <button key={tp} className={`tag-btn ${sheetData.throwPurpose === tp ? 'selected' : ''}`} onClick={() => setSheetData({ ...sheetData, throwPurpose: tp })}>{tp}</button>
                  ))}
                </div>
              </>
            )}

            {/* Turn Cause */}
            {actionNeedsTurnCause(pendingAction) && (
              <>
                <div className="section-label">Turn Cause *</div>
                <div className="tag-grid">
                  {TURN_CAUSES.map(tc => (
                    <button key={tc} className={`tag-btn ${sheetData.turnCause === tc ? 'selected' : ''}`} onClick={() => setSheetData({ ...sheetData, turnCause: tc })}>{tc}</button>
                  ))}
                </div>
              </>
            )}

            {/* Pressure Credit */}
            {actionNeedsTurnCause(pendingAction) && sheetData.turnCause && sheetData.turnCause !== 'Unforced' && (
              <>
                <div className="section-label">Pressure Credit Player *</div>
                <div className="player-picker">
                  {players.map(p => (
                    <button
                      key={p.id}
                      className={`player-pick-btn ${sheetData.pressureCreditPlayerId === p.id ? 'selected' : ''}`}
                      onClick={() => setSheetData({ ...sheetData, pressureCreditPlayerId: p.id })}
                    >
                      {playerLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Block Type */}
            {actionNeedsBlockType(pendingAction) && (
              <>
                <div className="section-label">Block Type *</div>
                <div className="tag-grid">
                  {BLOCK_TYPES.map(bt => (
                    <button key={bt} className={`tag-btn ${sheetData.blockType === bt ? 'selected' : ''}`} onClick={() => setSheetData({ ...sheetData, blockType: bt })}>{bt}</button>
                  ))}
                </div>
              </>
            )}

            {/* Scored On Defender (Goal only) */}
            {pendingAction === 'Goal' && (
              <>
                <div className="section-label">Scored On Defender (optional)</div>
                <div className="player-picker">
                  <button
                    className={`player-pick-btn ${!sheetData.scoredOnDefenderId ? 'selected' : ''}`}
                    onClick={() => setSheetData({ ...sheetData, scoredOnDefenderId: null })}
                  >
                    None
                  </button>
                  {players.map(p => (
                    <button
                      key={p.id}
                      className={`player-pick-btn ${sheetData.scoredOnDefenderId === p.id ? 'selected' : ''}`}
                      onClick={() => setSheetData({ ...sheetData, scoredOnDefenderId: p.id })}
                    >
                      {playerLabel(p)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEvent}>
                {editingEvent ? 'Update' : 'Save'} Event
              </button>
              <button className="btn" onClick={() => { setPendingAction(null); setEditingEvent(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
