export type Action = 'Catch' | 'Throwaway' | 'Goal' | 'Pull' | 'D' | 'Drop' | 'Callahan' | 'Pressure' | 'Error';
export type PressureType = 'Took away forceside under' | 'Forced second reset look' | 'Caused throw diversion on mark';
export type ErrorType = 'Mark let easy break throw off' | 'Downfield defender allowed easy under to force side' | 'Defender did not seal around and allowed breakside continue' | 'Allowed opponent upline' | 'Switched force' | 'Punished poach';
export type ThrowType = 'Backhand' | 'Forehand' | 'Hammer' | 'Scoober' | 'Blade' | 'Push' | 'Off Hand';
export type ThrowPurpose = 'Reset/Dump' | 'Swing' | 'Under' | 'Upline/Continue' | 'Inside Break' | 'Around Break' | 'Huck/Deep';
export type TurnCause = 'Unforced' | 'Mark Pressure' | 'Downfield Pressure' | 'Poach/Help';
export type BlockType = 'Under' | 'Poach' | 'Deep' | 'Point';
export type LineRole = 'O' | 'D' | 'Both';

export interface Roster { id?: number; name: string; seedKey?: string; createdAt: number; updatedAt: number; }
export interface Player { id?: number; rosterId: number; name: string; number: string; lineRole: LineRole; active: boolean; avatarFile?: string | null; createdAt: number; updatedAt: number; }
export interface Game { id?: number; rosterId: number; title: string; dateTime: string; tournament: string; opponent: string; notes: string; createdAt: number; updatedAt: number; }
export interface GameEvent { id?: number; gameId: number; seq: number; timestamp: number; action: Action; passerId?: number | null; receiverId?: number | null; defenderId?: number | null; throwType?: ThrowType | null; throwPurpose?: ThrowPurpose | null; turnCause?: TurnCause | null; pressureCreditPlayerId?: number | null; blockType?: BlockType | null; scoredOnDefenderId?: number | null; pressureType?: PressureType | null; errorType?: ErrorType | null; }

export const ACTIONS: Action[] = ['Catch', 'Throwaway', 'Goal', 'Pull', 'D', 'Drop', 'Callahan', 'Pressure', 'Error'];
export const PRESSURE_TYPES: PressureType[] = ['Took away forceside under', 'Forced second reset look', 'Caused throw diversion on mark'];
export const ERROR_TYPES: ErrorType[] = ['Mark let easy break throw off', 'Downfield defender allowed easy under to force side', 'Defender did not seal around and allowed breakside continue', 'Allowed opponent upline', 'Switched force', 'Punished poach'];
export const THROW_TYPES: ThrowType[] = ['Backhand', 'Forehand', 'Hammer', 'Scoober', 'Blade', 'Push', 'Off Hand'];
export const THROW_PURPOSES: ThrowPurpose[] = ['Reset/Dump', 'Swing', 'Under', 'Upline/Continue', 'Inside Break', 'Around Break', 'Huck/Deep'];
export const TURN_CAUSES: TurnCause[] = ['Unforced', 'Mark Pressure', 'Downfield Pressure', 'Poach/Help'];
export const BLOCK_TYPES: BlockType[] = ['Under', 'Poach', 'Deep', 'Point'];
export const LINE_ROLES: LineRole[] = ['O', 'D', 'Both'];

export function playerLabel(p: Player): string { return '#' + p.number + ' ' + p.name; }
export function actionNeedsThrow(action: Action): boolean { return action === 'Catch' || action === 'Throwaway' || action === 'Goal' || action === 'Drop'; }
export function actionNeedsTurnCause(action: Action): boolean { return action === 'Throwaway' || action === 'Drop'; }
export function actionNeedsBlockType(action: Action): boolean { return action === 'D' || action === 'Callahan'; }
export function actionNeedsReceiver(action: Action): boolean { return action === 'Catch' || action === 'Goal' || action === 'Drop'; }
export function actionNeedsDefender(action: Action): boolean { return action === 'D' || action === 'Callahan'; }
