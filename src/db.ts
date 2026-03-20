import Dexie, { type Table } from 'dexie';
import type { Roster, Player, Game, GameEvent } from './types';

class UltimateDB extends Dexie {
  rosters!: Table<Roster, number>;
  players!: Table<Player, number>;
  games!: Table<Game, number>;
  events!: Table<GameEvent, number>;

  constructor() {
    super('UltimateFilmTagger');
    this.version(1).stores({
      rosters: '++id, name, updatedAt',
      players: '++id, rosterId, name, number',
      games: '++id, rosterId, updatedAt',
      events: '++id, gameId, [gameId+seq]',
    });
    this.version(2).stores({
      rosters: '++id, name, seedKey, updatedAt',
      players: '++id, rosterId, name, number',
      games: '++id, rosterId, updatedAt',
      events: '++id, gameId, [gameId+seq]',
    });
  }
}

export const db = new UltimateDB();

export async function getAllRosters(): Promise<Roster[]> { return db.rosters.orderBy('updatedAt').reverse().toArray(); }
export async function createRoster(name: string): Promise<number> { const now = Date.now(); return db.rosters.add({ name, createdAt: now, updatedAt: now }); }
export async function updateRoster(id: number, name: string): Promise<void> { await db.rosters.update(id, { name, updatedAt: Date.now() }); }
export async function deleteRoster(id: number): Promise<void> {
  await db.transaction('rw', db.rosters, db.players, db.games, db.events, async () => {
    const games = await db.games.where('rosterId').equals(id).toArray();
    for (const g of games) { await db.events.where('gameId').equals(g.id!).delete(); }
    await db.games.where('rosterId').equals(id).delete();
    await db.players.where('rosterId').equals(id).delete();
    await db.rosters.delete(id);
  });
}

export async function getPlayersForRoster(rosterId: number): Promise<Player[]> { return db.players.where('rosterId').equals(rosterId).toArray(); }
export async function createPlayer(data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> { const now = Date.now(); return db.players.add({ ...data, createdAt: now, updatedAt: now }); }
export async function updatePlayer(id: number, data: Partial<Player>): Promise<void> { await db.players.update(id, { ...data, updatedAt: Date.now() }); }
export async function deletePlayer(id: number): Promise<void> { await db.players.delete(id); }

export async function getAllGames(): Promise<Game[]> { return db.games.orderBy('updatedAt').reverse().toArray(); }
export async function getGame(id: number): Promise<Game | undefined> { return db.games.get(id); }
export async function createGame(data: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> { const now = Date.now(); return db.games.add({ ...data, createdAt: now, updatedAt: now }); }
export async function updateGame(id: number, data: Partial<Game>): Promise<void> { await db.games.update(id, { ...data, updatedAt: Date.now() }); }
export async function deleteGame(id: number): Promise<void> {
  await db.transaction('rw', db.games, db.events, async () => {
    await db.events.where('gameId').equals(id).delete();
    await db.games.delete(id);
  });
}
export async function duplicateGame(id: number): Promise<number> {
  const game = await db.games.get(id);
  if (!game) throw new Error('Game not found');
  const now = Date.now();
  const newId = await db.games.add({ rosterId: game.rosterId, title: game.title + ' (copy)', dateTime: game.dateTime, tournament: game.tournament, opponent: game.opponent, notes: game.notes, createdAt: now, updatedAt: now });
  const events = await db.events.where('gameId').equals(id).toArray();
  for (const evt of events) { const { id: _eid, ...rest } = evt; await db.events.add({ ...rest, gameId: newId }); }
  return newId;
}

export async function seedDoomRoster(): Promise<void> {
  const existing = await db.rosters.where('seedKey').equals('doom-seed').count();
  if (existing > 0) return;
  const now = Date.now();
  const rosterId = await db.rosters.add({ name: 'DOOM', seedKey: 'doom-seed', createdAt: now, updatedAt: now });
  const players = [
    'Charlie Aubitz', 'Chris Killy', 'Dean Lourenco', 'Frank Tan',
    'Grady Bosch', 'John Vanderwege', 'Julian Bosco', 'Kfir Shoham',
    'Nicholas Rubino', 'Quinn Daly', 'Risen Zhang', 'Ross DiOrio',
    'Sawyer Falkenbush', 'Austin Chang', 'Cedar Conly', 'Joey Chura',
    'Micah Scheinkman', 'Nathan Greenwald', 'Sam Sutton', 'Silas Johnson',
    'Zane Levy', "Alex O'Neil", 'Casey Kelley', 'Eamon Conneely', 'James Tibola',
  ];
  for (const name of players) {
    await db.players.add({ rosterId, name, number: '', lineRole: 'Both', active: true, createdAt: now, updatedAt: now });
  }
}

export async function getEventsForGame(gameId: number): Promise<GameEvent[]> { return db.events.where('gameId').equals(gameId).sortBy('seq'); }
export async function getNextSeq(gameId: number): Promise<number> { const events = await db.events.where('gameId').equals(gameId).toArray(); if (events.length === 0) return 1; return Math.max(...events.map(e => e.seq)) + 1; }
export async function addEvent(data: Omit<GameEvent, 'id'>): Promise<number> { const id = await db.events.add(data as GameEvent); await db.games.update(data.gameId, { updatedAt: Date.now() }); return id; }
export async function updateEvent(id: number, data: Partial<GameEvent>): Promise<void> { const evt = await db.events.get(id); if (evt) { await db.events.update(id, data); await db.games.update(evt.gameId, { updatedAt: Date.now() }); } }
export async function deleteLastEvent(gameId: number): Promise<void> { const events = await getEventsForGame(gameId); if (events.length > 0) { const last = events[events.length - 1]; await db.events.delete(last.id!); await db.games.update(gameId, { updatedAt: Date.now() }); } }
