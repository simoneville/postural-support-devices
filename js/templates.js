// Starting points for common postural support devices. Dimensions are
// typical adult sizes; adjust to the user's measurements.

import { newProject, newPart, newBracket, defaultCover } from './model.js';
import { defaultParams } from './geometry.js';

const part = (shape, name, params, over = {}) =>
  newPart(shape, { name, params: { ...defaultParams(shape), ...params }, ...over });

const cover = (over = {}) => ({ ...defaultCover(), ...over });

function contouredSeat(x = 0, y = 0) {
  return [
    part('block', 'Seat base', { w: 430, d: 450, h: 40 }, {
      pos: { x, y, z: 9 }, foam: 'hr50', base: 'ply9',
      cover: cover({ antiSlip: true }),
      brackets: [
        newBracket('seat-hook', { face: 'bottom', u: -185, v: -150 }),
        newBracket('seat-hook', { face: 'bottom', u: 185, v: -150 }),
        newBracket('seat-hook', { face: 'bottom', u: -185, v: 150 }),
        newBracket('seat-hook', { face: 'bottom', u: 185, v: 150 }),
      ],
    }),
    part('scoop', 'Contoured top layer', { w: 430, d: 450, h: 50, sw: 320, s: 18 }, {
      pos: { x, y, z: 49 }, foam: 've50',
      cover: cover({ notes: 'One cover over both seat layers.' }),
    }),
  ];
}

function lateralPair(x0, y, z, gap) {
  return [
    part('lateral', 'Left thoracic lateral', { w: 60, d: 160, h: 200, s: 15 }, {
      pos: { x: x0, y, z }, rot: 180, foam: 'hr50',
      brackets: [newBracket('lateral-swing', { face: 'left', u: 0, v: 20 })],
    }),
    part('lateral', 'Right thoracic lateral', { w: 60, d: 160, h: 200, s: 15 }, {
      pos: { x: x0 + 60 + gap, y, z }, rot: 0, foam: 'hr50',
      brackets: [newBracket('lateral-swing', { face: 'right', u: 0, v: 20 })],
    }),
  ];
}

export const TEMPLATES = {
  seat: {
    label: 'Contoured seat cushion',
    desc: 'Firm base on a plywood board with drop hooks, memory-foam contoured top.',
    build: () => {
      const p = newProject({ name: 'Contoured seat cushion' });
      p.parts = contouredSeat();
      return p;
    },
  },
  wedge: {
    label: 'Anti-thrust wedge seat',
    desc: 'Wedge rising towards the front to reduce forward sliding.',
    build: () => {
      const p = newProject({ name: 'Anti-thrust wedge seat' });
      p.parts = [
        part('wedge', 'Anti-thrust wedge', { w: 430, d: 450, h: 50, h2: 90 }, {
          pos: { x: 0, y: 0, z: 9 }, foam: 'hr40', base: 'ply9',
          brackets: [
            newBracket('seat-hook', { face: 'bottom', u: -185, v: -150 }),
            newBracket('seat-hook', { face: 'bottom', u: 185, v: -150 }),
            newBracket('seat-hook', { face: 'bottom', u: -185, v: 150 }),
            newBracket('seat-hook', { face: 'bottom', u: 185, v: 150 }),
          ],
        }),
      ];
      return p;
    },
  },
  laterals: {
    label: 'Thoracic laterals (pair)',
    desc: 'Curved pads on swing-away brackets, set for a 340 mm trunk width.',
    build: () => {
      const p = newProject({ name: 'Thoracic lateral supports' });
      p.parts = lateralPair(0, 0, 0, 340);
      return p;
    },
  },
  headrest: {
    label: 'Curved headrest',
    desc: 'Concave occipital pad on a multi-axis headrest mount.',
    build: () => {
      const p = newProject({ name: 'Curved headrest' });
      p.parts = [
        part('lateral', 'Headrest pad', { w: 70, d: 250, h: 160, s: 25 }, {
          rot: 90, foam: 'hr40', base: 'none',
          brackets: [newBracket('headrest-mount', { face: 'back', u: 0, v: 0 })],
        }),
      ];
      return p;
    },
  },
  pommel: {
    label: 'Abductor pommel',
    desc: 'Chamfered block on a quick-release plate to keep the knees apart.',
    build: () => {
      const p = newProject({ name: 'Abductor pommel' });
      p.parts = [
        part('chamfer', 'Pommel', { w: 70, d: 130, h: 80, c: 15 }, {
          pos: { x: 0, y: 0, z: 3 }, foam: 'hr50', base: 'abs3',
          cover: cover({ material: 'vinyl', closure: 'zip', zipFace: 'bottom' }),
          brackets: [newBracket('qr-plate', { face: 'bottom', l: 60, w: 100 })],
        }),
      ];
      return p;
    },
  },
  system: {
    label: 'Full seating system',
    desc: 'Contoured seat, back support, thoracic laterals and headrest together.',
    build: () => {
      const p = newProject({ name: 'Seating system' });
      const back = part('block', 'Back support', { w: 430, d: 60, h: 480 }, {
        pos: { x: 0, y: 450, z: 12 }, foam: 'hr40', base: 'none',
        brackets: [
          newBracket('back-hardware', { face: 'back', u: -170, v: 60 }),
          newBracket('back-hardware', { face: 'back', u: 170, v: 60 }),
        ],
      });
      const [l, r] = lateralPair(0, 290, 260, 310);
      const head = part('lateral', 'Headrest pad', { w: 70, d: 250, h: 160, s: 25 }, {
        pos: { x: 90, y: 440, z: 540 }, rot: 90, foam: 'hr40',
        brackets: [newBracket('headrest-mount', { face: 'back', u: 0, v: 0 })],
      });
      p.parts = [...contouredSeat(), back, l, r, head];
      return p;
    },
  },
};
