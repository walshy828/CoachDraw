export interface Pt {
  x: number;
  y: number;
}

export type TokenKind = 'player' | 'goalie' | 'puck' | 'cone';
export type Team = 'off' | 'def';
export type PathKind = 'skate' | 'carry' | 'back' | 'pass' | 'shot';
export type RinkView = 'full' | 'half-left' | 'half-right';

export interface Token {
  id: string;
  kind: TokenKind;
  label: string;
  team: Team;
  x: number;
  y: number;
  color?: string;
}

export interface DrawPath {
  id: string;
  /** Token that moves along this path (the puck for pass/shot). Null = decorative only. */
  tokenId: string | null;
  kind: PathKind;
  stepId: string;
  points: Pt[];
  color: string;
  /** Extra seconds to hold before this line starts (after its trigger, or the previous line of the same token). */
  delay?: number;
  /** Start when another line in the same step has reached this fraction (0-1) of its length. */
  after?: { pathId: string; at: number };
  /** Speed multiplier (1 = normal). */
  speed?: number;
}

export interface Step {
  id: string;
  title: string;
  caption: string;
}

export interface DrillDoc {
  tokens: Token[];
  paths: DrawPath[];
  steps: Step[];
  colors: { off: string; def: string };
}

export interface DrillMeta {
  name: string;
  description: string;
  notes: string;
  category: string;
  ageGroup: string;
  durationMin: number;
  tags: string[];
  rinkView: RinkView;
}

export interface Drill extends DrillMeta {
  id: number;
  doc: DrillDoc;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORIES = [
  'Warm-up',
  'Breakout',
  'Zone Entry',
  'Offensive Zone',
  'Backcheck / Tracking',
  'Regroup',
  'Transition',
  'Shooting',
  'Passing',
  'Puck Management',
  'Special Teams',
  'Game Play',
  'Other',
] as const;

export const DEFAULT_COLORS = { off: '#f2b705', def: '#d62839' };

/** Positions where a team may only have one player on the ice. */
export const UNIQUE_POSITIONS = ['C', 'LW', 'RW', 'LD', 'RD', 'G'] as const;
