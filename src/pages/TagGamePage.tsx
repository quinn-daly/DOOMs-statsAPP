import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGame, getPlayersForRoster, getEventsForGame, getNextSeq, addEvent, updateEvent, deleteLastEvent } from '../db';
import type { Game, Player, GameEvent, Action, ThrowType, ThrowPurpose, TurnCause, BlockType, PressureType, ErrorType } from '../types';
import { THROW_TYPES, THROW_PURPOSES, TURN_CAUSES, BLOCK_TYPES, PRESSURE_TYPES, ERROR_TYPES, playerLabel } from '../types';

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

  const [phase, setPhase] = useState<Phase>('line-select');
  const [isOLine, setIsOLine] = useState(true);
  const [currentLine, setCurrentLine] = useState<number[]>([]);
  const [lastOLine, setLastOLine] = useState<number[]>([]);
  const [lastDLine, setLastDLine] = useState<number[]>([]);
  const [discHolderId, setDiscHolderId] = useState<number | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [subMode, setSubMode] = useState(false);
  const [preSubPhase, setPreSubPhase] = useState<Phase>('defense');

  const [followUp, setFollowUp] = useState<FollowUpCtx | null>(null);
  const [throwType, setThrowType] = useState<ThrowType | null>(null);
  const [throwPurpose, setThrowPurpose] = useState<ThrowPurpose | null>(null);
  const [turnCause, setTurnCause] = useState<TurnCause | null>(null);
  const [blockType, setBlockType] = useState<BlockType | null>(null);
  const [pressurePlayer, setPressurePlayer] = useState<number | null>(null);
  const [pressureType, setPressureType] = useState<PressureType | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [scoredOnDefender, setScoredOnDefender] = useState<number | null>(null);
  const [stickyThrow, setStickyThrow] = useState<ThrowType | null>(null);
  const [stickyPurpose, setStickyPurpose] = useState<ThrowPurpose | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);

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

  const saveEvt = async (d: Partial<GameEvent> & { action: Action }) => {
    const seq = await getNextSeq(gameId);
    await addEvent({ gameId, seq, timestamp: Date.now(), action: d.action, passerId: d.passerId || null, receiverId: d.receiverId || null, defenderId: d.defenderId || null, throwType: d.throwType || null, throwPurpose: d.throwPurpose || null, turnCause: d.turnCause || null, pressureCreditPlayerId: d.pressureCreditPlayerId || null, blockType: d.blockType || null, scoredOnDefenderId: d.scoredOnDefenderId || null, pressureType: d.pressureType || null, errorType: d.errorType || null });
    await load();
    showToast('Saved ✓');
  };

  const togglePlayer = (pid: number) => {
    setCurrentLine(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : prev.length >= 7 ? prev : [...prev, pid]);
  };
  const confirmLine = () => {
    if (currentLine.length === 0) { showToast('Select at least 1 player'); return; }
    if (subMode) { setSubMode(false); setPhase(preSubPhase); return; }
    if (isOLine) setLastOLine([...currentLine]); else setLastDLine([...currentLine]);
    setPhase(isOLine ? 'pick-initial' : 'defense');
  };

  const handleSub = () => {
    setPreSubPhase(phase);
    setSubMode(true);
    setPhase('line-select');
  };

  const pickInitial = (pid: number) => { setDiscHolderId(pid); setPhase('offense'); };

  const openFollowUp = (action: Action, passerId: number | null, receiverId: number | null, defenderId: number | null) => {
    setFollowUp({ action, passerId, receiverId, defenderId });
    setThrowType(stickyThrow); setThrowPurpose(stickyPurpose);
    setTurnCause(null); setBlockType(null); setPressurePlayer(null); setScoredOnDefender(null); setPressureType(null); setErrorType(null);
    setPhase('follow-up');
  };

  const handleTheyScored = () => {
    openFollowUp('Goal', null, null, -1);
  };

  const handleFollowUpSave = async () => {
    if (!followUp) return;
    const { action, passerId, receiverId, defenderId } = followUp;
    const isTheyScored = action === 'Goal' && defenderId === -1;
    const isOffenseThrow = !isTheyScored && (action === 'Catch' || action === 'Goal' || action === 'Drop' || (action === 'Throwaway' && !!passerId));
    const isDefenseTA = action === 'Throwaway' && !passerId;
    const needsBlock = action === 'D';
    const needsTurn = (action === 'Throwaway' || action === 'Drop') && !isDefenseTA;

    if (action === 'Pressure' && !pressureType) { showToast('Select pressure type'); return; }
    if (action === 'Error' && !errorType) { showToast('Select error type'); return; }
    if (isOffenseThrow && !throwType) { showToast('Select throw type'); return; }
    if (isOffenseThrow && !throwPurpose) { showToast('Select throw purpose'); return; }
    if (needsTurn && !turnCause) { showToast('Select turn cause'); return; }
    if (needsBlock && !blockType) { showToast('Select block type'); return; }

    if (throwType) setStickyThrow(throwType);
    if (throwPurpose) setStickyPurpose(throwPurpose);

    const evtData = {
      action, passerId, receiverId, defenderId,
      throwType: isOffenseThrow ? throwType : null,
      throwPurpose: isOffenseThrow ? throwPurpose : null,
      turnCause: (needsTurn || isDefenseTA) ? turnCause : null,
      pressureCreditPlayerId: isDefenseTA ? pressurePlayer : null,
      blockType: needsBlock ? blockType : null,
      scoredOnDefenderId: isTheyScored ? scoredOnDefender : null,
      pressureType: (action === 'Pressure' || isDefenseTA) ? pressureType : null,
      errorType: action === 'Error' ? errorType : null,
    };

    if (editingEvent) {
      await updateEvent(editingEvent.id!, evtData);
      setEditingEvent(null); setFollowUp(null); await load();
      if (action === 'Pressure' || action === 'Error') setPhase('defense');
      else setPhase(discHolderId ? 'offense' : 'defense');
      showToast('Updated ✓'); return;
    }

    await saveEvt(evtData);

    if (action === 'Pressure' || action === 'Error') { setFollowUp(null); setPhase('defense'); }
    else if (isTheyScored) { setDiscHolderId(null); setCurrentLine([]); setIsOLine(true); setFollowUp(null); setPhase('line-select'); }
    else if (action === 'Catch') { setDiscHolderId(receiverId); setPhase('offense'); }
    else if (action === 'Goal' && passerId) { setDiscHolderId(null); setCurrentLine([]); setIsOLine(false); setPhase('line-select'); }
    else if (action === 'Drop' || (action === 'Throwaway' && !!passerId)) { setDiscHolderId(null); setPhase('defense'); }
    else if (action === 'D') { setDiscHolderId(null); setPhase('pick-initial'); }
    else if (action === 'Callahan') { setDiscHolderId(null); setCurrentLine([]); setIsOLine(false); setPhase('line-select'); }
    else if (isDefenseTA) { setDiscHolderId(null); setPhase('pick-initial'); }

    setFollowUp(null);
  };

  const cancelFollowUp = () => {
    if (editingEvent) { setEditingEvent(null); setFollowUp(null); setPhase(discHolderId ? 'offense' : 'defense'); return; }
    const act = followUp?.action;
    setFollowUp(null);
    if (act === 'Pressure' || act === 'Error') { setPhase('defense'); return; }
    if (act === 'Goal' && followUp?.defenderId === -1) { setPhase('defense'); return; }
    setPhase(followUp?.passerId ? 'offense' : 'defense');
  };

  const handleUndo = async () => {
    if (events.length === 0) return;
    if (!confirm('Undo last event?')) return;
    await deleteLastEvent(gameId);
    const evts = await getEventsForGame(gameId);
    setEvents(evts); computeScore(evts);
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

  const describeEvent = (evt: GameEvent): string => {
    if (evt.action === 'Goal' && evt.defenderId === -1) return 'They Scored';
    const p: string[] = [];
    switch (evt.action) {
      case 'Catch': p.push(pName(evt.passerId) + ' → ' + pName(evt.receiverId)); break;
      case 'Goal': p.push(pName(evt.passerId) + ' → ' + pName(evt.receiverId) + ' GOAL'); break;
      case 'Throwaway': p.push(evt.passerId ? pName(evt.passerId) + ' throwaway' : 'Opp. throwaway'); if (!evt.passerId && evt.pressureType) p.push('Forced: ' + evt.pressureType); break;
      case 'Drop': p.push(pName(evt.receiverId) + ' drop'); break;
      case 'D': p.push('D by ' + pName(evt.defenderId)); break;
      case 'Callahan': p.push('Callahan ' + pName(evt.defenderId)); break;
      case 'Pull': p.push('Pull ' + pName(evt.defenderId)); break;
      case 'Pressure': p.push(pName(evt.defenderId)); if (evt.pressureType) p.push(evt.pressureType); break;
      case 'Error': p.push(pName(evt.defenderId)); if (evt.errorType) p.push(evt.errorType); break;
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
    setPressureType(evt.pressureType || null); setErrorType(evt.errorType || null);
    setPhase('follow-up');
  };

  // Derived state for follow-up sheet
  const fuAction = followUp?.action;
  const fuPasserId = followUp?.passerId;
  const fuDefenderId = followUp?.defenderId;
  const isTheyScored = fuAction === 'Goal' && fuDefenderId === -1;
  const isOffThrow = !!(fuAction && !isTheyScored && (fuAction === 'Catch' || fuAction === 'Goal' || fuAction === 'Drop' || (fuAction === 'Throwaway' && !!fuPasserId)));
  const isDefTA = fuAction === 'Throwaway' && !fuPasserId;
  const needsBlk = fuAction === 'D';
  const needsTrn = !!(fuAction && (fuAction === 'Throwaway' || fuAction === 'Drop') && !isDefTA);
  const showPressure = isDefTA;

  if (!game) return <div className="text-muted" style={{ padding: 16 }}>Loading...</div>;

  const reversedEvents = [...events].reverse().slice(0, 15);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">In Game</div>
          <div className="font-doom" style={{ fontSize: '1.3rem', color: 'var(--doom-bone)' }}>{game.title}</div>
          {game.opponent && <div className="label-mono">vs {game.opponent}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-doom" style={{ fontSize: 32, color: 'var(--doom-orange-bright)', lineHeight: 1 }}>
            {score[0]} <span className="text-muted" style={{ fontSize: 20 }}>–</span> {score[1]}
          </div>
          <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => nav('/export/' + gameId)}>Export</button>
        </div>
      </div>

      {/* ══ LINE SELECT ══ */}
      {phase === 'line-select' && (
        <div>
          <div className={`badge ${isOLine ? 'badge-orange' : 'badge-purple'} mb-3`}>
            {isOLine ? 'O-Line' : 'D-Line'}
          </div>

          {/* Selected players */}
          <div className="card mb-3">
            <div className="label-mono mb-2">On field ({currentLine.length}/7)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentLine.map(pid => {
                const p = playerById(pid);
                return p ? (
                  <button key={pid} className="player-pill selected" onClick={() => togglePlayer(pid)}>
                    <span className="player-number">{p.number}</span>
                    <span className="player-name">{p.name}</span>
                  </button>
                ) : null;
              })}
              {currentLine.length === 0 && <span className="text-muted text-sm">Tap players below to add</span>}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {isOLine && lastOLine.length > 0 && (
                <button className="btn btn-sm btn-primary" onClick={() => setCurrentLine([...lastOLine])}>Last O-Line</button>
              )}
              {!isOLine && lastDLine.length > 0 && (
                <button className="btn btn-sm" style={{ color: 'var(--doom-purple-bright)', borderColor: 'var(--doom-purple)' }} onClick={() => setCurrentLine([...lastDLine])}>Last D-Line</button>
              )}
              {currentLine.length > 0 && (
                <button className="btn btn-sm btn-ghost" onClick={() => setCurrentLine([])}>Clear</button>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={confirmLine} disabled={currentLine.length === 0}
              style={{ borderColor: subMode ? 'var(--doom-orange-bright)' : 'var(--doom-purple-bright)', color: subMode ? 'var(--doom-orange-bright)' : 'var(--doom-purple-bright)', padding: '0 120px', alignSelf: 'stretch', fontSize: '1rem', letterSpacing: '0.25em', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
              {subMode ? 'Confirm Sub' : 'Confirm Line'}
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" onClick={() => setIsOLine(!isOLine)}>
              Switch to {isOLine ? 'D' : 'O'}
            </button>
          </div>

          {/* Player list */}
          <div className="card-list">
            {[...allPlayers].sort((a, b) => {
              const last = (n: string) => n.trim().split(' ').pop() || '';
              return last(a.name).localeCompare(last(b.name));
            }).map(p => {
              const on = currentLine.includes(p.id!);
              const words = p.name.split(' ').filter(w => !w.startsWith('('));
              const initials = ((words[0]?.[0] || '') + (words[words.length - 1]?.[0] || '')).toUpperCase();
              return (
                <div
                  key={p.id}
                  className={`card card-row${on ? ' card-accent' : ''}`}
                  style={{ padding: '4px 14px', minHeight: 48, cursor: 'pointer', ...(on ? { borderColor: 'var(--page-accent)' } : {}) }}
                  onClick={() => togglePlayer(p.id!)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {p.avatarFile
                      ? <img src={`/DOOMs-statsAPP/avatars/${p.avatarFile}`} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={p.name} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%', background: on ? 'var(--page-accent)' : 'var(--doom-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--doom-bone)', flexShrink: 0 }}>{initials}</div>
                    }
                    <div>
                      {p.number && <span style={{ color: 'var(--page-accent)', fontFamily: "'Share Tech Mono', monospace", fontSize: 13 }}>#{p.number} </span>}
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--doom-bone)' }}>{p.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ══ PICK INITIAL ══ */}
      {phase === 'pick-initial' && (
        <div>
          <div className="badge badge-green mb-3">Offense</div>
          <div className="label-mono mb-4">Who picked up the disc?</div>
          <div className="player-grid">
            {linePlayers.map(p => (
              <button key={p.id} className="player-tile" onClick={() => pickInitial(p.id!)}>
                <div className="player-tile-number">{p.number}</div>
                <div className="player-tile-info">
                  <div className="player-tile-name">{p.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ OFFENSE ══ */}
      {phase === 'offense' && (
        <div>
          <div className="disc-banner">
            <div className="disc-dot">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="16" rx="13" ry="4.5" stroke="var(--page-accent)" strokeWidth="2" />
                <ellipse cx="16" cy="16" rx="8" ry="2.5" stroke="var(--page-accent)" strokeWidth="1" opacity="0.5" />
              </svg>
            </div>
            <div>
              <div className="disc-holder-label">Disc Holder</div>
              <div className="disc-holder-name">{pName(discHolderId)}</div>
            </div>
          </div>

          <div className="card-list">
            {linePlayers.map(p => {
              const isH = p.id === discHolderId;
              return (
                <div key={p.id} className={`card card-row${isH ? ' card-accent' : ''}`} style={{ padding: '10px 14px' }}>
                  <div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>#{p.number}</span>
                  </div>
                  {isH ? (
                    <span className="label-accent">has disc</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" style={{ background: 'var(--btn-catch-bg)', borderColor: 'var(--btn-catch-border)', color: 'var(--btn-catch-text)' }} onClick={() => openFollowUp('Catch', discHolderId, p.id!, null)}>Catch</button>
                      <button className="btn btn-sm" style={{ background: 'var(--btn-drop-bg)', borderColor: 'var(--btn-drop-border)', color: 'var(--btn-drop-text)' }} onClick={() => openFollowUp('Drop', discHolderId, p.id!, null)}>Drop</button>
                      <button className="btn btn-sm" style={{ background: 'var(--btn-goal-bg)', borderColor: 'var(--btn-goal-border)', color: 'var(--btn-goal-text)' }} onClick={() => openFollowUp('Goal', discHolderId, p.id!, null)}>Goal</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn w-full" style={{ marginTop: 12, background: 'var(--btn-throw-bg)', borderColor: 'var(--btn-throw-border)', color: 'var(--btn-throw-text)' }} onClick={() => openFollowUp('Throwaway', discHolderId, null, null)}>
            Throwaway by {pName(discHolderId)}
          </button>
        </div>
      )}

      {/* ══ DEFENSE ══ */}
      {phase === 'defense' && (
        <div>
          <div className="defense-banner">
            <span className="defense-banner-text">▶ Defense</span>
          </div>

          <div className="card-list">
            {linePlayers.map(p => (
              <div key={p.id} className="card card-row" style={{ padding: '10px 14px' }}>
                <div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                  <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>#{p.number}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" style={{ background: 'var(--btn-d-bg)', borderColor: 'var(--btn-d-border)', color: 'var(--btn-d-text)' }} onClick={() => openFollowUp('D', null, null, p.id!)}>D</button>
                  <button className="btn btn-sm" style={{ background: 'var(--btn-callahan-bg)', borderColor: 'var(--btn-callahan-border)', color: 'var(--btn-callahan-text)' }} onClick={() => openFollowUp('Callahan', null, p.id!, p.id!)}>Callahan</button>
                  <button className="btn btn-sm" style={{ borderColor: '#22c55e', color: '#22c55e' }} onClick={() => openFollowUp('Pressure', null, null, p.id!)}>Pressure</button>
                  <button className="btn btn-sm btn-danger" onClick={() => openFollowUp('Error', null, null, p.id!)}>Error</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => openFollowUp('Throwaway', null, null, null)}>Opp. Throwaway</button>
            <button className="btn btn-danger" onClick={handleTheyScored}>They Scored</button>
          </div>
        </div>
      )}

      {/* ══ FOLLOW-UP SHEET ══ */}
      {phase === 'follow-up' && followUp && (
        <div className="sheet-overlay" onClick={cancelFollowUp}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">
              {editingEvent ? 'Edit: ' : ''}
              {isTheyScored ? 'They Scored' : followUp.action}
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              {followUp.passerId && followUp.passerId > 0 && <span className="badge badge-orange">{pName(followUp.passerId)}</span>}
              {followUp.passerId && followUp.receiverId && followUp.receiverId > 0 && <span className="text-muted">→</span>}
              {followUp.receiverId && followUp.receiverId > 0 && <span className="badge badge-orange">{pName(followUp.receiverId)}</span>}
              {followUp.defenderId && followUp.defenderId > 0 && <span className="badge badge-purple">{fuAction === 'Pressure' ? '▲ ' : fuAction === 'Error' ? '✕ ' : 'D: '}{pName(followUp.defenderId)}</span>}
            </div>

            {/* Throw Type + Purpose */}
            {isOffThrow && (
              <>
                <div className="label-accent mb-2">Throw Type *</div>
                <div className="option-grid">
                  {THROW_TYPES.map(t => <button key={t} className={`option-btn${throwType === t ? ' selected' : ''}`} onClick={() => setThrowType(t)}>{t}</button>)}
                </div>
                <div className="label-accent mb-2">Throw Purpose *</div>
                <div className="option-grid">
                  {THROW_PURPOSES.map(t => <button key={t} className={`option-btn${throwPurpose === t ? ' selected' : ''}`} onClick={() => setThrowPurpose(t)}>{t}</button>)}
                </div>
              </>
            )}

            {/* Turn Cause */}
            {(needsTrn || isDefTA) && (
              <>
                <div className="label-accent mb-2">Turn Cause {followUp.passerId ? '*' : '(optional)'}</div>
                <div className="option-grid">
                  {TURN_CAUSES.map(t => (
                    <button key={t} className={`option-btn${turnCause === t ? ' selected' : ''}`} onClick={() => setTurnCause(t)}>{t}</button>
                  ))}
                </div>
              </>
            )}

            {/* Pressure Type — for standalone Pressure events */}
            {fuAction === 'Pressure' && (
              <>
                <div className="label-accent mb-2">Pressure Type *</div>
                <div className="option-grid">
                  {PRESSURE_TYPES.map(t => <button key={t} className={`option-btn${pressureType === t ? ' selected' : ''}`} onClick={() => setPressureType(t)}>{t}</button>)}
                </div>
              </>
            )}

            {/* Error Type — for standalone Error events */}
            {fuAction === 'Error' && (
              <>
                <div className="label-accent mb-2">Error Type *</div>
                <div className="option-grid">
                  {ERROR_TYPES.map(t => <button key={t} className={`option-btn${errorType === t ? ' selected' : ''}`} onClick={() => setErrorType(t)}>{t}</button>)}
                </div>
              </>
            )}

            {/* Pressure Credit — defender who forced opponent throwaway */}
            {showPressure && (
              <>
                <div className="label-accent mb-2">Was this forced? (optional)</div>
                <div className="option-grid">
                  <button className={`option-btn${!pressureType ? ' selected' : ''}`} onClick={() => setPressureType(null)}>Not forced</button>
                  {PRESSURE_TYPES.map(t => <button key={t} className={`option-btn${pressureType === t ? ' selected' : ''}`} onClick={() => setPressureType(t)}>{t}</button>)}
                </div>
              </>
            )}

            {/* Block Type */}
            {needsBlk && (
              <>
                <div className="label-accent mb-2">Block Type *</div>
                <div className="option-grid">
                  {BLOCK_TYPES.map(t => <button key={t} className={`option-btn${blockType === t ? ' selected' : ''}`} onClick={() => setBlockType(t)}>{t}</button>)}
                </div>
              </>
            )}

            {/* Scored On — which of our defenders got beaten (only when they score) */}
            {isTheyScored && (
              <>
                <div className="label-accent mb-2">Which defender got scored on? (optional)</div>
                <div className="option-grid">
                  <button className={`option-btn${!scoredOnDefender ? ' selected' : ''}`} onClick={() => setScoredOnDefender(null)}>None</button>
                  {linePlayers.map(p => (
                    <button key={p.id} className={`option-btn${scoredOnDefender === p.id ? ' selected' : ''}`} onClick={() => setScoredOnDefender(p.id!)}>{playerLabel(p)}</button>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFollowUpSave}>{editingEvent ? 'Update' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={cancelFollowUp}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EVENT FEED ══ */}
      {phase !== 'line-select' && (
        <div className="event-feed" style={{ marginTop: 16 }}>
          <div className="event-feed-header">
            <span className="label-mono">{events.length} events</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {events.length > 0 && (
                <button className="btn btn-sm btn-danger" onClick={handleUndo}>Undo ↩</button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={handleSub}>SUB</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { setSubMode(false); setPhase('line-select'); }}>Line</button>
            </div>
          </div>
          {reversedEvents.map(evt => (
            <div key={evt.id} className="event-row" onClick={() => handleEditEvent(evt)}>
              <span className="event-seq">{evt.seq}</span>
              <span className={`event-action-tag ${evt.defenderId === -1 ? 'throwaway' : evt.action.toLowerCase()}`}>
                {evt.defenderId === -1 ? 'THEY' : evt.action}
              </span>
              <span className="event-detail">{describeEvent(evt)}</span>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
