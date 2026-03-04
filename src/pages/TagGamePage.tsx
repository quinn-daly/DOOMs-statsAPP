import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGame, getPlayersForRoster, getEventsForGame, getNextSeq, addEvent, updateEvent, deleteLastEvent } from '../db';
import type { Game, Player, GameEvent, Action, ThrowType, ThrowPurpose, TurnCause, BlockType } from '../types';
import { THROW_TYPES, THROW_PURPOSES, TURN_CAUSES, BLOCK_TYPES, playerLabel } from '../types';

type Phase = 'line-select' | 'pick-initial' | 'offense' | 'defense' | 'follow-up';

interface FollowUpCtx {
  action: Action;
  passerId: number | null;
  receiverId: number | null;
  defenderId: number | null;
}

export default function TagGamePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const gameId = Number(id);

  const [game, setGame] = useState<Game | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);

  // Point / phase state
  const [phase, setPhase] = useState<Phase>('line-select');
  const [isOLine, setIsOLine] = useState(true);
  const [currentLine, setCurrentLine] = useState<number[]>([]);
  const [lastOLine, setLastOLine] = useState<number[]>([]);
  const [lastDLine, setLastDLine] = useState<number[]>([]);
  const [discHolderId, setDiscHolderId] = useState<number | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);

  // Follow-up
  const [followUp, setFollowUp] = useState<FollowUpCtx | null>(null);
  const [throwType, setThrowType] = useState<ThrowType | null>(null);
  const [throwPurpose, setThrowPurpose] = useState<ThrowPurpose | null>(null);
  const [turnCause, setTurnCause] = useState<TurnCause | null>(null);
  const [blockType, setBlockType] = useState<BlockType | null>(null);
  const [pressurePlayer, setPressurePlayer] = useState<number | null>(null);
  const [scoredOnDefender, setScoredOnDefender] = useState<number | null>(null);
  const [stickyThrow, setStickyThrow] = useState<ThrowType | null>(null);
  const [stickyPurpose, setStickyPurpose] = useState<ThrowPurpose | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);

  // ── Load ──
  const load = useCallback(async () => {
    const g = await getGame(gameId);
    if (!g) { nav('/'); return; }
    setGame(g);
    const p = await getPlayersForRoster(g.rosterId);
    p.sort((a, b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
    setAllPlayers(p.filter(pl => pl.active));
    const evts = await getEventsForGame(gameId);
    setEvents(evts);
    computeScore(evts);
  }, [gameId, nav]);

  useEffect(() => { load(); }, [load]);

  const computeScore = (evts: GameEvent[]) => {
    let ours = 0, theirs = 0;
    for (const e of evts) {
      if (e.action === 'Goal' && e.defenderId === -1) theirs++;
      else if (e.action === 'Goal') ours++;
      else if (e.action === 'Callahan') ours++;
    }
    setScore([ours, theirs]);
  };

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1400); };
  const playerById = (pid: number | null) => (!pid || pid < 0) ? null : allPlayers.find(p => p.id === pid) || null;
  const pName = (pid: number | null | undefined) => { if (!pid || pid < 0) return '?'; const p = allPlayers.find(p => p.id === pid); return p ? playerLabel(p) : '?'; };
  const linePlayers = currentLine.map(id => playerById(id)).filter(Boolean) as Player[];

  // ── Save event ──
  const saveEvt = async (d: Partial<GameEvent> & { action: Action }) => {
    const seq = await getNextSeq(gameId);
    await addEvent({ gameId, seq, timestamp: Date.now(), action: d.action, passerId: d.passerId || null, receiverId: d.receiverId || null, defenderId: d.defenderId || null, throwType: d.throwType || null, throwPurpose: d.throwPurpose || null, turnCause: d.turnCause || null, pressureCreditPlayerId: d.pressureCreditPlayerId || null, blockType: d.blockType || null, scoredOnDefenderId: d.scoredOnDefenderId || null });
    await load();
    showToast('Saved ✓');
  };

  // ═══ LINE SELECT ═══
  const togglePlayer = (pid: number) => {
    setCurrentLine(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : prev.length >= 7 ? prev : [...prev, pid]);
  };
  const confirmLine = () => {
    if (currentLine.length === 0) { showToast('Select at least 1 player'); return; }
    if (isOLine) setLastOLine([...currentLine]); else setLastDLine([...currentLine]);
    setPhase(isOLine ? 'pick-initial' : 'defense');
  };

  // ═══ PICK INITIAL ═══
  const pickInitial = (pid: number) => { setDiscHolderId(pid); setPhase('offense'); };

  // ═══ OFFENSE ACTIONS ═══
  const openFollowUp = (action: Action, passerId: number | null, receiverId: number | null, defenderId: number | null) => {
    setFollowUp({ action, passerId, receiverId, defenderId });
    setThrowType(stickyThrow); setThrowPurpose(stickyPurpose);
    setTurnCause(null); setBlockType(null); setPressurePlayer(null); setScoredOnDefender(null);
    setPhase('follow-up');
  };

  // ═══ DEFENSE: They Scored ═══
  const handleTheyScored = async () => {
    await saveEvt({ action: 'Goal', defenderId: -1 });
    setDiscHolderId(null); setCurrentLine([]); setIsOLine(true); setPhase('line-select');
  };

  // ═══ FOLLOW-UP SAVE ═══
  const handleFollowUpSave = async () => {
    if (!followUp) return;
    const { action, passerId, receiverId, defenderId } = followUp;
    const isOffenseThrow = action === 'Catch' || action === 'Goal' || action === 'Drop' || (action === 'Throwaway' && !!passerId);
    const isDefenseTA = action === 'Throwaway' && !passerId;
    const needsBlock = action === 'D' || action === 'Callahan';
    const needsTurn = (action === 'Throwaway' || action === 'Drop') && !isDefenseTA;

    if (isOffenseThrow && !throwType) { showToast('Select throw type'); return; }
    if (isOffenseThrow && !throwPurpose) { showToast('Select throw purpose'); return; }
    if (needsTurn && !turnCause) { showToast('Select turn cause'); return; }
    if (needsTurn && turnCause !== 'Unforced' && !pressurePlayer) { showToast('Select pressure credit'); return; }
    if (isDefenseTA && turnCause && turnCause !== 'Unforced' && !pressurePlayer) { showToast('Select pressure credit'); return; }
    if (needsBlock && !blockType) { showToast('Select block type'); return; }

    if (throwType) setStickyThrow(throwType);
    if (throwPurpose) setStickyPurpose(throwPurpose);

    if (editingEvent) {
      await updateEvent(editingEvent.id!, { action, passerId, receiverId, defenderId, throwType: isOffenseThrow ? throwType : null, throwPurpose: isOffenseThrow ? throwPurpose : null, turnCause: (needsTurn || isDefenseTA) ? turnCause : null, pressureCreditPlayerId: pressurePlayer, blockType: needsBlock ? blockType : null, scoredOnDefenderId: scoredOnDefender });
      setEditingEvent(null); setFollowUp(null); await load();
      setPhase(discHolderId ? 'offense' : 'defense');
      showToast('Updated ✓'); return;
    }

    await saveEvt({ action, passerId, receiverId, defenderId, throwType: isOffenseThrow ? throwType : null, throwPurpose: isOffenseThrow ? throwPurpose : null, turnCause: (needsTurn || isDefenseTA) ? turnCause : null, pressureCreditPlayerId: pressurePlayer, blockType: needsBlock ? blockType : null, scoredOnDefenderId: scoredOnDefender });

    // Transition
    if (action === 'Catch') { setDiscHolderId(receiverId); setPhase('offense'); }
    else if (action === 'Goal' && passerId) { setDiscHolderId(null); setCurrentLine([]); setIsOLine(false); setPhase('line-select'); }
    else if (action === 'Drop' || (action === 'Throwaway' && !!passerId)) { setDiscHolderId(null); setPhase('defense'); }
    else if (action === 'D') { setDiscHolderId(null); setPhase('pick-initial'); }
    else if (action === 'Callahan') { setDiscHolderId(null); setCurrentLine([]); setIsOLine(false); setPhase('line-select'); }
    else if (isDefenseTA) { setDiscHolderId(null); setPhase('pick-initial'); }

    setFollowUp(null);
  };

  const cancelFollowUp = () => {
    if (editingEvent) { setEditingEvent(null); setFollowUp(null); setPhase(discHolderId ? 'offense' : 'defense'); return; }
    setFollowUp(null);
    setPhase(followUp?.passerId ? 'offense' : 'defense');
  };

  // ═══ UNDO ═══
  const handleUndo = async () => {
    if (events.length === 0) return;
    if (!confirm('Undo last event?')) return;
    await deleteLastEvent(gameId);
    const evts = await getEventsForGame(gameId);
    setEvents(evts); computeScore(evts);
    // Rebuild disc state
    let holder: number | null = null;
    let poss: 'o' | 'd' = isOLine ? 'o' : 'd';
    for (const e of evts) {
      if (e.action === 'Catch') { holder = e.receiverId || null; poss = 'o'; }
      else if (e.action === 'Goal') { holder = null; }
      else if (e.action === 'Drop' || (e.action === 'Throwaway' && e.passerId)) { holder = null; poss = 'd'; }
      else if (e.action === 'D' || (e.action === 'Throwaway' && !e.passerId)) { holder = null; poss = 'o'; }
      else if (e.action === 'Callahan') { holder = null; }
    }
    setDiscHolderId(holder);
    if (holder) setPhase('offense');
    else if (poss === 'o') setPhase('pick-initial');
    else setPhase('defense');
    showToast('Undone');
  };

  // ═══ Event description ═══
  const describeEvent = (evt: GameEvent): string => {
    if (evt.action === 'Goal' && evt.defenderId === -1) return 'They Scored';
    const p: string[] = [];
    switch (evt.action) {
      case 'Catch': p.push(pName(evt.passerId) + ' → ' + pName(evt.receiverId)); break;
      case 'Goal': p.push(pName(evt.passerId) + ' → ' + pName(evt.receiverId) + ' GOAL'); break;
      case 'Throwaway': p.push(evt.passerId ? pName(evt.passerId) + ' throwaway' : 'Opp. throwaway'); break;
      case 'Drop': p.push(pName(evt.receiverId) + ' drop'); break;
      case 'D': p.push('D by ' + pName(evt.defenderId)); break;
      case 'Callahan': p.push('Callahan ' + pName(evt.defenderId)); break;
      case 'Pull': p.push('Pull ' + pName(evt.defenderId)); break;
    }
    if (evt.throwType) p.push(evt.throwType);
    if (evt.blockType) p.push(evt.blockType);
    return p.join(' · ');
  };

  const handleEditEvent = (evt: GameEvent) => {
    setEditingEvent(evt);
    setFollowUp({ action: evt.action, passerId: evt.passerId || null, receiverId: evt.receiverId || null, defenderId: evt.defenderId || null });
    setThrowType(evt.throwType || null); setThrowPurpose(evt.throwPurpose || null);
    setTurnCause(evt.turnCause || null); setBlockType(evt.blockType || null);
    setPressurePlayer(evt.pressureCreditPlayerId || null); setScoredOnDefender(evt.scoredOnDefenderId || null);
    setPhase('follow-up');
  };

  if (!game) return <div className="page"><p className="text-muted">Loading...</p></div>;
  const reversedEvents = [...events].reverse().slice(0, 15);

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div className="flex-between mb-8">
        <div>
          <div className="page-title" style={{ marginBottom: 0, fontSize: 16 }}>{game.title}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--accent-green)' }}>{score[0]} – {score[1]} <span className="text-muted" style={{ fontSize: 13, fontWeight: 400 }}>{game.opponent && 'vs ' + game.opponent}</span></div>
        </div>
        <button className="btn btn-sm" onClick={() => nav('/export/' + gameId)}>Export</button>
      </div>

      {/* ══ LINE SELECT ══ */}
      {phase === 'line-select' && (<div>
        <div className="phase-badge" style={{ background: isOLine ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>{isOLine ? 'O-LINE' : 'D-LINE'}</div>

        {/* Selected */}
        <div className="line-field-box">
          <div className="text-muted text-sm mb-8">Field ({currentLine.length}/7)</div>
          <div className="line-chips">
            {currentLine.map(pid => { const p = playerById(pid); return p ? <button key={pid} className="line-chip on" onClick={() => togglePlayer(pid)}>{playerLabel(p)}</button> : null; })}
            {currentLine.length === 0 && <span className="text-muted text-sm">Tap players below to add</span>}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {isOLine && lastOLine.length > 0 && <button className="btn btn-sm" style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }} onClick={() => setCurrentLine([...lastOLine])}>Last O-Line</button>}
          {!isOLine && lastDLine.length > 0 && <button className="btn btn-sm" style={{ color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }} onClick={() => setCurrentLine([...lastDLine])}>Last D-Line</button>}
          {currentLine.length > 0 && <button className="btn btn-sm" onClick={() => setCurrentLine([])}>Clear</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => setIsOLine(!isOLine)}>Switch {isOLine ? 'D' : 'O'}</button>
        </div>

        {/* Roster grid */}
        <div className="line-roster-grid">
          {allPlayers.map(p => { const on = currentLine.includes(p.id!); return (
            <button key={p.id} className={`line-roster-cell ${on ? 'on' : ''}`} onClick={() => togglePlayer(p.id!)}>
              <span className="cell-name">{p.name}</span>
              <span className="cell-meta"><span className="cell-role">{p.lineRole !== 'Both' ? p.lineRole : ''}</span><span className="cell-num">#{p.number}</span></span>
            </button>
          ); })}
        </div>

        <button className="btn btn-primary btn-block mt-16" onClick={confirmLine} disabled={currentLine.length === 0}>Confirm Line →</button>
      </div>)}

      {/* ══ PICK INITIAL ══ */}
      {phase === 'pick-initial' && (<div>
        <div className="phase-badge" style={{ background: 'var(--accent-green)' }}>OFFENSE</div>
        <div className="phase-instruction">Tap the player who picked up the disc</div>
        <div className="pick-grid">
          {linePlayers.map(p => <button key={p.id} className="pick-btn" onClick={() => pickInitial(p.id!)}>{playerLabel(p)}</button>)}
        </div>
      </div>)}

      {/* ══ OFFENSE ══ */}
      {phase === 'offense' && (<div>
        <div className="phase-badge" style={{ background: 'var(--accent-green)' }}>OFFENSE</div>
        <div className="disc-holder-bar">🥏 {pName(discHolderId)} has the disc</div>

        <div className="context-table">
          <div className="ctx-header"><div className="ctx-col-name">Passer</div><div className="ctx-col-acts">Receiver</div></div>
          {linePlayers.map(p => {
            const isH = p.id === discHolderId;
            return (<div key={p.id} className={`ctx-row ${isH ? 'holder' : ''}`}>
              <div className="ctx-name">{p.name} <span className="text-muted text-sm">#{p.number}</span>{isH && <span className="disc-dot">🥏</span>}</div>
              {isH
                ? <div className="ctx-acts"><span className="text-muted text-sm">has disc</span></div>
                : <div className="ctx-acts">
                    <button className="ctx-btn c-btn" onClick={() => openFollowUp('Catch', discHolderId, p.id!, null)}>Catch</button>
                    <button className="ctx-btn d-btn" onClick={() => openFollowUp('Drop', discHolderId, p.id!, null)}>Drop</button>
                    <button className="ctx-btn g-btn" onClick={() => openFollowUp('Goal', discHolderId, p.id!, null)}>Goal</button>
                  </div>}
            </div>);
          })}
        </div>

        <button className="ta-bar" onClick={() => openFollowUp('Throwaway', discHolderId, null, null)}>
          Throwaway by {pName(discHolderId)}
        </button>
      </div>)}

      {/* ══ DEFENSE ══ */}
      {phase === 'defense' && (<div>
        <div className="phase-badge" style={{ background: 'var(--accent-cyan)' }}>DEFENSE</div>

        <div className="context-table">
          <div className="ctx-header"><div className="ctx-col-name">Defender</div><div className="ctx-col-acts"></div></div>
          {linePlayers.map(p => (
            <div key={p.id} className="ctx-row">
              <div className="ctx-name">{p.name} <span className="text-muted text-sm">#{p.number}</span></div>
              <div className="ctx-acts">
                <button className="ctx-btn db-btn" onClick={() => openFollowUp('D', null, null, p.id!)}>D</button>
                <button className="ctx-btn cal-btn" onClick={() => openFollowUp('Callahan', null, p.id!, p.id!)}>Callahan</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button className="ta-bar opp" onClick={() => openFollowUp('Throwaway', null, null, null)}>Opp. Throwaway</button>
          <button className="ta-bar scored" onClick={handleTheyScored}>They Scored</button>
        </div>
      </div>)}

      {/* ══ FOLLOW-UP SHEET ══ */}
      {phase === 'follow-up' && followUp && (
        <div className="modal-overlay" onClick={cancelFollowUp}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h3>{editingEvent ? 'Edit' : ''} {followUp.action}</h3>
            <div className="fu-summary">
              {followUp.passerId && followUp.passerId > 0 && <span className="fu-player">{pName(followUp.passerId)}</span>}
              {followUp.passerId && followUp.receiverId && followUp.receiverId > 0 && <span className="fu-arrow"> → </span>}
              {followUp.receiverId && followUp.receiverId > 0 && <span className="fu-player">{pName(followUp.receiverId)}</span>}
              {followUp.defenderId && followUp.defenderId > 0 && <span className="fu-player">D: {pName(followUp.defenderId)}</span>}
            </div>

            {/* Throw Type + Purpose */}
            {(followUp.action === 'Catch' || followUp.action === 'Goal' || followUp.action === 'Drop' || (followUp.action === 'Throwaway' && !!followUp.passerId)) && (<>
              <div className="section-label">Throw Type *</div>
              <div className="tag-grid">{THROW_TYPES.map(t => <button key={t} className={`tag-btn ${throwType === t ? 'selected' : ''}`} onClick={() => setThrowType(t)}>{t}</button>)}</div>
              <div className="section-label">Throw Purpose *</div>
              <div className="tag-grid">{THROW_PURPOSES.map(t => <button key={t} className={`tag-btn ${throwPurpose === t ? 'selected' : ''}`} onClick={() => setThrowPurpose(t)}>{t}</button>)}</div>
            </>)}

            {/* Turn Cause */}
            {(followUp.action === 'Throwaway' || followUp.action === 'Drop') && (<>
              <div className="section-label">Turn Cause {followUp.passerId ? '*' : '(optional)'}</div>
              <div className="tag-grid">{TURN_CAUSES.map(t => <button key={t} className={`tag-btn ${turnCause === t ? 'selected' : ''}`} onClick={() => { setTurnCause(t); if (t === 'Unforced') setPressurePlayer(null); }}>{t}</button>)}</div>
            </>)}

            {/* Pressure Credit */}
            {(followUp.action === 'Throwaway' || followUp.action === 'Drop') && turnCause && turnCause !== 'Unforced' && (<>
              <div className="section-label">Pressure Credit *</div>
              <div className="player-picker">{linePlayers.map(p => <button key={p.id} className={`player-pick-btn ${pressurePlayer === p.id ? 'selected' : ''}`} onClick={() => setPressurePlayer(p.id!)}>{playerLabel(p)}</button>)}</div>
            </>)}

            {/* Block Type */}
            {(followUp.action === 'D' || followUp.action === 'Callahan') && (<>
              <div className="section-label">Block Type *</div>
              <div className="tag-grid">{BLOCK_TYPES.map(t => <button key={t} className={`tag-btn ${blockType === t ? 'selected' : ''}`} onClick={() => setBlockType(t)}>{t}</button>)}</div>
            </>)}

            {/* Scored On */}
            {followUp.action === 'Goal' && followUp.passerId && (<>
              <div className="section-label">Scored On Defender (optional)</div>
              <div className="player-picker">
                <button className={`player-pick-btn ${!scoredOnDefender ? 'selected' : ''}`} onClick={() => setScoredOnDefender(null)}>None</button>
                {allPlayers.map(p => <button key={p.id} className={`player-pick-btn ${scoredOnDefender === p.id ? 'selected' : ''}`} onClick={() => setScoredOnDefender(p.id!)}>{playerLabel(p)}</button>)}
              </div>
            </>)}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFollowUpSave}>{editingEvent ? 'Update' : 'Save'}</button>
              <button className="btn" onClick={cancelFollowUp}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EVENT FEED ══ */}
      {phase !== 'line-select' && (<div className="mt-16">
        <div className="flex-between mb-8">
          <span className="text-muted text-sm" style={{ fontFamily: 'var(--font-display)' }}>{events.length} EVENTS</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {events.length > 0 && <button className="btn btn-sm btn-danger" onClick={handleUndo}>Undo ↩</button>}
            <button className="btn btn-sm" onClick={() => setPhase('line-select')}>Line</button>
          </div>
        </div>
        <ul className="event-list">{reversedEvents.map(evt => (
          <li className="event-item" key={evt.id} onClick={() => handleEditEvent(evt)}>
            <span className="event-seq">{evt.seq}</span>
            <span className={`event-action-badge ${evt.defenderId === -1 ? 'they-scored' : evt.action.toLowerCase()}`}>{evt.defenderId === -1 ? 'THEY' : evt.action}</span>
            <span className="event-detail">{describeEvent(evt)}</span>
          </li>
        ))}</ul>
      </div>)}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
