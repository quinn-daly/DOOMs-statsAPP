export type Action = 'Catch' | 'Throwaway' | 'Goal' | 'Pull' | 'D' | 'Drop' | 'Callahan';
export type ThrowType = 'Backhand' | 'Forehand' | 'Hammer' | 'Scoober' | 'Blade' | 'Push/Other';
export type ThrowPurpose = 'Reset/Dump' | 'Swing' | 'Under' | 'Upline/Continue' | 'Break Attempt' | 'Huck/Deep';
export type TurnCause = 'Unforced' | 'Mark Pressure' | 'Downfield Pressure' | 'Poach/Help';
export type BlockType = 'Layout' | 'Hand' | 'Poach' | 'Deep' | 'Mark' | 'Other';
export type LineRole = 'O' | 'D' | 'Both';

export interface Roster { id?: number; name: string; seedKey?: string; createdAt: number; updatedAt: number; }
export interface Player { id?: number; rosterId: number; name: string; number: string; lineRole: LineRole; active: boolean; createdAt: number; updatedAt: number; }
export interface Game { id?: number; rosterId: number; title: string; dateTime: string; tournament: string; opponent: string; notes: string; createdAt: number; updatedAt: number; }
export interface GameEvent { id?: number; gameId: number; seq: number; timestamp: number; action: Action; passerId?: number | null; receiverId?: number | null; defenderId?: number | null; throwType?: ThrowType | null; throwPurpose?: ThrowPurpose | null; turnCause?: TurnCause | null; pressureCreditPlayerId?: number | null; blockType?: BlockType | null; scoredOnDefenderId?: number | null; }

export const ACTIONS: Action[] = ['Catch', 'Throwaway', 'Goal', 'Pull', 'D', 'Drop', 'Callahan'];
export const THROW_TYPES: ThrowType[] = ['Backhand', 'Forehand', 'Hammer', 'Scoober', 'Blade', 'Push/Other'];
export const THROW_PURPOSES: ThrowPurpose[] = ['Reset/Dump', 'Swing', 'Under', 'Upline/Continue', 'Break Attempt', 'Huck/Deep'];
export const TURN_CAUSES: TurnCause[] = ['Unforced', 'Mark Pressure', 'Downfield Pressure', 'Poach/Help'];
export const BLOCK_TYPES: BlockType[] = ['Layout', 'Hand', 'Poach', 'Deep', 'Mark', 'Other'];
export const LINE_ROLES: LineRole[] = ['O', 'D', 'Both'];

export function playerLabel(p: Player): string { return '#' + p.number + ' ' + p.name; }
export function actionNeedsThrow(action: Action): boolean { return action === 'Catch' || action === 'Throwaway' || action === 'Goal' || action === 'Drop'; }
export function actionNeedsTurnCause(action: Action): boolean { return action === 'Throwaway' || action === 'Drop'; }
export function actionNeedsBlockType(action: Action): boolean { return action === 'D' || action === 'Callahan'; }
export function actionNeedsReceiver(action: Action): boolean { return action === 'Catch' || action === 'Goal' || action === 'Drop'; }
export function actionNeedsDefender(action: Action): boolean { return action === 'D' || action === 'Callahan'; }
