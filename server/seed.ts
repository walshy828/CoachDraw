import { catmullRom } from '../shared/geometry';
import type { DrawPath, DrillDoc, DrillMeta, PathKind, Pt, Step, Team, Token } from '../shared/types';
import { DEFAULT_COLORS } from '../shared/types';
import { insertDrill } from './drills';

type XY = [number, number];
interface Timing {
  delay?: number;
  /** Start when this earlier line (by id) is `at` (0-1) of the way along. */
  after?: [pathId: string, at: number];
  speed?: number;
}
const timingProps = (t?: Timing) => ({
  ...(t?.delay ? { delay: t.delay } : {}),
  ...(t?.after ? { after: { pathId: t.after[0], at: t.after[1] } } : {}),
  ...(t?.speed ? { speed: t.speed } : {}),
});

/** Small helper to author drills as sequences of steps. Coordinates are rink feet (200 x 85). */
class Builder {
  tokens: Token[] = [];
  paths: DrawPath[] = [];
  steps: Step[] = [];
  private cur: Record<string, Pt> = {};
  private n = 0;
  private puckId: string | null = null;
  private uid(prefix: string) {
    return `${prefix}${++this.n}`;
  }

  private colorOf(id: string) {
    const t = this.tokens.find((x) => x.id === id)!;
    return t.color ?? DEFAULT_COLORS[t.team];
  }

  player(label: string, team: Team, x: number, y: number, color?: string) {
    return this.addToken('player', label, team, x, y, color);
  }
  goalie(x: number, y: number) {
    return this.addToken('goalie', 'G', 'def', x, y);
  }
  cone(x: number, y: number) {
    return this.addToken('cone', '', 'off', x, y);
  }
  puck(x: number, y: number) {
    this.puckId = this.addToken('puck', '', 'off', x, y);
    return this.puckId;
  }
  private addToken(kind: Token['kind'], label: string, team: Team, x: number, y: number, color?: string) {
    const id = this.uid('t');
    this.tokens.push({ id, kind, label, team, x, y, ...(color ? { color } : {}) });
    this.cur[id] = { x, y };
    return id;
  }

  step(title: string, caption: string) {
    const id = this.uid('s');
    this.steps.push({ id, title, caption });
    return id;
  }

  /** Move a token from where it last ended through the waypoints (curved when 2+ waypoints). */
  move(step: string, who: string, kind: Extract<PathKind, 'skate' | 'carry' | 'back'>, pts: XY[], timing?: Timing): string {
    const wp: Pt[] = [this.cur[who], ...pts.map(([x, y]) => ({ x, y }))];
    const points = wp.length >= 3 ? catmullRom(wp, 8) : wp;
    const id = this.uid('p');
    this.paths.push({ id, tokenId: who, kind, stepId: step, points, color: this.colorOf(who), ...timingProps(timing) });
    this.cur[who] = wp[wp.length - 1];
    return id;
  }

  /** Puck pass or shot from where the puck is now to a player (their current end position) or a point. */
  send(step: string, kind: 'pass' | 'shot', to: string | XY, by: string, timing?: Timing): string {
    const from = this.cur[this.puckId!];
    const target: Pt = typeof to === 'string' ? this.cur[to] : { x: to[0], y: to[1] };
    const id = this.uid('p');
    this.paths.push({
      id,
      tokenId: this.puckId,
      kind,
      stepId: step,
      points: [from, target],
      color: this.colorOf(by),
      ...timingProps(timing),
    });
    this.cur[this.puckId!] = target;
    return id;
  }

  doc(): DrillDoc {
    return { tokens: this.tokens, paths: this.paths, steps: this.steps, colors: { ...DEFAULT_COLORS } };
  }
}

interface Sample {
  meta: DrillMeta;
  doc: DrillDoc;
}

const meta = (m: Partial<DrillMeta> & Pick<DrillMeta, 'name' | 'category'>): DrillMeta => ({
  description: '',
  notes: '',
  ageGroup: '',
  durationMin: 10,
  tags: [],
  rinkView: 'full',
  ...m,
});

function twoOnOneBacktrack(): Sample {
  const b = new Builder();
  const g = b.goalie(186, 42.5);
  const c = b.player('C', 'off', 55, 30);
  const rw = b.player('RW', 'off', 55, 56);
  const d1 = b.player('LD', 'def', 128, 42);
  b.puck(55, 30);
  void g;

  const s1 = b.step('Attack 2-on-1', 'C and RW enter the zone side by side. LD keeps the middle and back-pedals, holding the gap.');
  b.move(s1, c, 'carry', [[95, 27], [130, 27], [152, 31]]);
  b.move(s1, rw, 'skate', [[95, 58], [130, 57], [152, 56]]);
  b.move(s1, d1, 'back', [[150, 42]]);

  const s2 = b.step('Pass across', 'C draws the defender then passes across to RW. RW should receive with the stick on the ice and shoot in stride.');
  b.move(s2, d1, 'skate', [[153, 47]]);
  b.send(s2, 'pass', rw, c);

  const s3 = b.step('Shoot and go to the net', 'RW shoots. C drives the far post for the rebound. LD tries to take away the stick.');
  b.send(s3, 'shot', [189, 41], rw);
  b.move(s3, c, 'skate', [[172, 36]]);
  b.move(s3, rw, 'skate', [[166, 52]]);

  const s4 = b.step('Backtrack and regroup', 'C backtracks first; RW follows once C is a quarter of the way back. LD holds, then joins the regroup as the outlet when C is past halfway.');
  const cBack = b.move(s4, c, 'back', [[130, 24], [92, 28]]);
  b.move(s4, rw, 'back', [[135, 60], [92, 58]], { after: [cBack, 0.25] });
  b.move(s4, d1, 'skate', [[110, 42]], { after: [cBack, 0.6] });

  return {
    meta: meta({
      name: '2-on-1 Backtrack with Regroup',
      category: 'Transition',
      ageGroup: 'U14 – U21',
      durationMin: 12,
      tags: ['2v1', 'backtrack', 'regroup', 'full ice'],
      description: 'Two forwards attack a single defender, finish, then immediately backtrack and regroup to go again.',
      notes: '- Defender: stay between the forwards, stick on the passing lane.\n- Forwards: attack with speed, pass early, shoot in stride.\n- After the shot the backtrack is full speed — no coasting.\n- Switch roles every rep.',
    }),
    doc: b.doc(),
  };
}

function breakoutDToD(): Sample {
  const b = new Builder();
  b.goalie(14, 42.5);
  const d1 = b.player('LD', 'def', 20, 24);
  const d2 = b.player('RD', 'def', 20, 61);
  const c = b.player('C', 'off', 36, 42);
  const lw = b.player('LW', 'off', 32, 12);
  const rw = b.player('RW', 'off', 32, 73);
  b.cone(24, 42);
  b.puck(22, 25);

  const s1 = b.step('Support the puck', 'LD has the puck behind pressure (cone). Wingers hug the boards, C swings low in the middle to give two short options.');
  b.move(s1, lw, 'skate', [[36, 10]]);
  b.move(s1, rw, 'skate', [[36, 75]]);
  b.move(s1, c, 'skate', [[30, 44]]);

  const s2 = b.step('D to D', 'LD moves the puck D-to-D to RD, who is already facing up-ice. Pass on the tape.');
  b.move(s2, d2, 'skate', [[20, 56]]);
  b.send(s2, 'pass', d2, d1);

  const s3 = b.step('Reverse to the strong-side winger', 'RD reverses the puck to RW on the boards. RW receives on the move.');
  b.move(s3, rw, 'skate', [[46, 70]]);
  b.send(s3, 'pass', rw, d2);

  const s4 = b.step('Go! Five-man support', 'RW exits with speed. C and LW attack the far side; both D follow as the third and fourth options.');
  b.move(s4, rw, 'carry', [[70, 66], [92, 58]]);
  b.move(s4, c, 'skate', [[62, 46], [90, 42]]);
  b.move(s4, lw, 'skate', [[64, 14], [92, 22]]);
  b.move(s4, d1, 'skate', [[44, 32], [64, 34]]);
  b.move(s4, d2, 'skate', [[44, 54], [64, 54]]);

  return {
    meta: meta({
      name: 'Breakout – D to D Reverse',
      category: 'Breakout',
      ageGroup: 'U12 – U21',
      durationMin: 10,
      rinkView: 'half-left',
      tags: ['breakout', 'D-to-D', 'reverse', 'half ice'],
      description: 'Beat the forecheck by reversing the puck D-to-D and exiting up the weak side.',
      notes: '- Win the first pass, then the second.\n- Wingers: hug the wall and show the stick as a target.\n- C is the safety valve low in the middle.\n- Add a live forechecker once the pattern is clean.',
    }),
    doc: b.doc(),
  };
}

function tenShotWarmup(): Sample {
  const b = new Builder();
  b.goalie(186, 42.5);
  const f1 = b.player('LW', 'off', 62, 16);
  const f2 = b.player('RW', 'off', 62, 69);
  const d1 = b.player('LD', 'def', 125, 10);
  const d2 = b.player('RD', 'def', 125, 75);
  b.puck(62, 16);

  const s1 = b.step('Pass up to the D', 'On the coach whistle LW passes to LD at the blue line and skates up the lane. RW does the same on the other side.');
  b.move(s1, f1, 'skate', [[100, 22], [148, 30]]);
  b.move(s1, f2, 'skate', [[100, 63], [148, 56]]);
  b.send(s1, 'pass', d1, f1);

  const s2 = b.step('Return pass in stride', 'LD returns the pass to LW. Good pass quality — on the tape, no stopping.');
  b.send(s2, 'pass', f1, d1);

  const s3 = b.step('Shoot to score, screen & tip', 'LW shoots to score. RW goes to the front of the net for the screen and tip. LW stays in front when LD shoots next.');
  b.send(s3, 'shot', [189, 41], f1);
  b.move(s3, f2, 'skate', [[176, 46]]);
  b.move(s3, f1, 'skate', [[170, 34]]);

  const s4 = b.step('Rotate lines', 'Everyone swings to the next station: forwards to the far corners, D hold the blue line for the next rep.');
  b.move(s4, f1, 'skate', [[150, 68], [100, 72], [62, 69]]);
  b.move(s4, f2, 'skate', [[150, 18], [100, 14], [62, 16]]);
  void d2;

  return {
    meta: meta({
      name: '10 Shot Warm-up Drill',
      category: 'Warm-up',
      ageGroup: 'U14 – U21',
      durationMin: 10,
      tags: ['warm-up', 'shooting', 'passing', 'full ice'],
      description: 'Start on the whistle on both sides. Give pass quality, shoot to score, and take screens and tips.',
      notes: '- Start always on coach whistle.\n- Good pass quality and scoring mentality.\n- Forward stays in front for the screen when the D take their shot.',
    }),
    doc: b.doc(),
  };
}

function backcheckTracking(): Sample {
  const b = new Builder();
  b.goalie(186, 42.5);
  const f1 = b.player('LW', 'off', 60, 20);
  const f2 = b.player('RW', 'off', 60, 65);
  const d1 = b.player('LD', 'def', 142, 30);
  const d2 = b.player('RD', 'def', 142, 55);
  const bc = b.player('BC', 'def', 82, 42);
  b.puck(60, 20);

  const s1 = b.step('Rush with a tracker', 'LW and RW attack 2-on-2 against the D. The backchecker (BC) starts behind the play and must catch up.');
  b.move(s1, f1, 'carry', [[96, 24], [128, 27], [150, 30]]);
  b.move(s1, f2, 'skate', [[96, 62], [128, 58], [150, 57]]);
  b.move(s1, d1, 'back', [[150, 32]]);
  b.move(s1, d2, 'back', [[150, 53]]);
  b.move(s1, bc, 'skate', [[108, 38], [138, 38]]);

  const s2 = b.step('Cross-ice pass', 'LW passes across to RW. D slide with the pass; BC picks up the late forward and lifts the stick.');
  b.move(s2, d2, 'skate', [[156, 50]]);
  b.move(s2, bc, 'skate', [[158, 44]]);
  b.send(s2, 'pass', f2, f1);

  const s3 = b.step('Shot and track', 'RW shoots. BC tracks the first forward to the net and takes away his stick. Whistle: switch roles.');
  b.send(s3, 'shot', [189, 41], f2);
  b.move(s3, f1, 'skate', [[173, 38]]);
  b.move(s3, bc, 'skate', [[170, 40]]);

  return {
    meta: meta({
      name: '2-1 / 2-2 with Backtracking',
      category: 'Backcheck / Tracking',
      ageGroup: 'U16 – U21',
      durationMin: 12,
      tags: ['backcheck', 'tracking', '2v2', 'full ice'],
      description: 'D at the blue line can start backtracking when the forward at the blue line touches the puck.',
      notes: '- Backchecker: get above the puck, stick on the ice, track the numbers.\n- D: hold the gap, communicate man-on / switch.\n- Rotate attackers, defenders and backcheckers each rep.',
    }),
    doc: b.doc(),
  };
}

function neutralZoneRegroup(): Sample {
  const b = new Builder();
  b.goalie(186, 42.5);
  const d1 = b.player('LD', 'def', 30, 24);
  const d2 = b.player('RD', 'def', 30, 61);
  const c = b.player('C', 'off', 62, 42);
  const lw = b.player('LW', 'off', 64, 12);
  const rw = b.player('RW', 'off', 64, 73);
  b.puck(32, 24);

  const s1 = b.step('D to D', 'LD passes D-to-D to RD while the forwards swing back for support.');
  b.move(s1, d2, 'skate', [[30, 52]]);
  b.send(s1, 'pass', d2, d1);
  b.move(s1, lw, 'skate', [[78, 20], [58, 30]]);
  b.move(s1, rw, 'skate', [[78, 65], [58, 55]]);

  const s2 = b.step('Outlet to C', 'C drops low, receives from RD with his feet moving.');
  b.move(s2, c, 'skate', [[52, 42]]);
  b.send(s2, 'pass', c, d2);

  const s3 = b.step('Turn up to LW', 'C turns and finds LW in stride at the red line. RW and C fill lanes; D join the rush as the trailer.');
  b.move(s3, lw, 'skate', [[72, 30], [100, 28]]);
  b.send(s3, 'pass', lw, c);
  b.move(s3, c, 'skate', [[85, 42], [108, 42]]);
  b.move(s3, rw, 'skate', [[100, 58]]);
  b.move(s3, d1, 'skate', [[62, 30]]);
  b.move(s3, d2, 'skate', [[62, 55]]);

  const s4 = b.step('Attack with speed', 'LW carries wide into the zone. C and RW attack the net on the far side for a shot and rebound.');
  b.move(s4, lw, 'carry', [[130, 26], [158, 28]]);
  b.move(s4, c, 'skate', [[135, 42], [168, 40]]);
  b.move(s4, rw, 'skate', [[135, 58], [165, 56]]);

  const s5 = b.step('Shot', 'LW shoots. C screens, RW takes the rebound lane.');
  b.send(s5, 'shot', [189, 41], lw);

  return {
    meta: meta({
      name: 'Neutral Zone Regroup 5v0',
      category: 'Regroup',
      ageGroup: 'U12 – U21',
      durationMin: 10,
      tags: ['regroup', 'neutral zone', 'passing', 'full ice'],
      description: 'Five players practise a clean regroup: D-to-D, outlet, turn up and attack with speed.',
      notes: '- Support the puck: always two passing options.\n- Pass ahead into speed; never stop at the blue line.\n- Progress to 5v5 with tracking forwards.',
    }),
    doc: b.doc(),
  };
}

function blueLinePuckManagement(): Sample {
  const b = new Builder();
  b.goalie(186, 42.5);
  const d1 = b.player('LD', 'def', 125, 18);
  const f1 = b.player('LW', 'off', 170, 28);
  const f2 = b.player('C', 'off', 172, 56);
  b.cone(108, 42);
  b.puck(108, 42);

  const s1 = b.step('Receive at the blue line', 'Coach (cone) passes to LD at the blue line. LD gets the puck on the stick and the head up.');
  b.send(s1, 'pass', d1, d1);

  const s2 = b.step('Hinge', 'LD hinges inside along the blue line to open a shooting lane. Forwards move to set the screen.');
  b.move(s2, d1, 'carry', [[130, 28], [124, 38]]);
  b.move(s2, f1, 'skate', [[178, 38]]);
  b.move(s2, f2, 'skate', [[176, 47]]);

  const s3 = b.step('Quick release', 'Shoot with a quick release through the screen for the deflection. Forwards stay in front for tips and rebounds.');
  b.send(s3, 'shot', [189, 42], d1);

  return {
    meta: meta({
      name: 'BL Puck Management',
      category: 'Puck Management',
      ageGroup: 'U16 – U21',
      durationMin: 8,
      rinkView: 'half-right',
      tags: ['blue line', 'defense', 'hinge', 'quick release', 'half ice'],
      description: '1. Quick release  2. Hinge  3. RIM pick-up and shot for deflection.',
      notes: '- Keep the puck alive at the blue line: no stick-handling into pressure.\n- Hinge to create a lane, then release quickly.\n- Variation: coach rims the puck and D picks it up on the boards before the shot.',
    }),
    doc: b.doc(),
  };
}


function wingerDSwap(): Sample {
  const b = new Builder();
  b.goalie(186, 42.5);
  const rw = b.player('RW', 'off', 164, 73);
  const rd = b.player('RD', 'off', 128, 62);
  const ld = b.player('LD', 'off', 128, 23);
  const c = b.player('C', 'off', 160, 42);
  b.puck(164, 73);

  const s1 = b.step('Winger pulls up, D holds then drops', 'RW skates up the wall with the puck. RD holds at the point and only drops down once RW is past halfway, taking the winger spot as RW rotates up.');
  const rwUp = b.move(s1, rw, 'carry', [[150, 76], [128, 66]]);
  b.move(s1, rd, 'skate', [[150, 70], [165, 72]], { after: [rwUp, 0.55] });
  b.move(s1, c, 'skate', [[176, 46]], { delay: 1 });
  b.move(s1, ld, 'skate', [[132, 30]], { after: [rwUp, 0.8] });

  const s2 = b.step('Low-to-high pass', 'RD (now low) receives the puck from RW at the point, then pass back up.');
  b.send(s2, 'pass', rd, rw);

  const s3 = b.step('Shot with traffic', 'RD returns the puck up high. RW shoots through the screen; C takes the front of the net.');
  b.send(s3, 'pass', rw, rd);
  b.send(s3, 'shot', [189, 40], rw, { delay: 0.5 });
  b.move(s3, c, 'skate', [[178, 42]]);

  return {
    meta: meta({
      name: 'D Rotation: Winger–Defenseman Swap',
      category: 'Offensive Zone',
      ageGroup: 'U14 – U21',
      durationMin: 10,
      rinkView: 'half-right',
      tags: ['rotation', 'swap', 'timing', 'half ice'],
      description: 'A winger skates up the boards while the defenseman holds, then drops down to take the winger spot once the winger gets close.',
      notes: '- Timing: the D does not move until the winger is past halfway (see the diamond marker).\n- Communicate the swap ("Switch!").\n- Keep the weak-side D on the blue line for the safety.',
    }),
    doc: b.doc(),
  };
}

export const sampleDrills = (): Sample[] => [
  wingerDSwap(),
  tenShotWarmup(),
  twoOnOneBacktrack(),
  breakoutDToD(),
  backcheckTracking(),
  neutralZoneRegroup(),
  blueLinePuckManagement(),
];

export function seedDrillsFor(userId: number) {
  for (const s of sampleDrills()) insertDrill(userId, s.meta, s.doc);
}
