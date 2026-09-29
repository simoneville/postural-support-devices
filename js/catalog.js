// Material, hardware and covering catalogues.
// Values are typical/indicative figures for specification purposes only;
// always confirm density, hardness and fire performance with the supplier.

export const FOAMS = {
  'hr35': {
    label: 'HR35 high-resilience (soft)',
    density: 35, hardness: 100, colour: '#f3dd9b',
    use: 'Comfort top layers, low-load areas.',
  },
  'hr40': {
    label: 'HR40 high-resilience (medium)',
    density: 40, hardness: 150, colour: '#f0c987',
    use: 'General-purpose seat and back bases.',
  },
  'hr50': {
    label: 'HR50 high-resilience (firm)',
    density: 50, hardness: 220, colour: '#e6ad6c',
    use: 'Structural bases, laterals, pommels.',
  },
  've50': {
    label: 'Visco-elastic (memory) 50',
    density: 50, hardness: 60, colour: '#b9d7c4',
    use: 'Pressure redistribution top layers. Temperature sensitive.',
  },
  'latex': {
    label: 'Natural latex 65',
    density: 65, hardness: 120, colour: '#efe7c8',
    use: 'Resilient comfort layers. Check for latex allergy.',
  },
  'pe45': {
    label: 'Closed-cell PE (LD45)',
    density: 45, hardness: 400, colour: '#c9d4e6',
    use: 'Thermoformable shells, water-resistant supports.',
  },
  'eva': {
    label: 'EVA closed-cell 60',
    density: 60, hardness: 450, colour: '#d8c7e3',
    use: 'Firm inserts, shims, abrasion-resistant pads.',
  },
  'recon': {
    label: 'Reconstituted (chip) foam 100',
    density: 100, hardness: 600, colour: '#d2b7a3',
    use: 'Very firm bases and packers.',
  },
};

export const BASES = {
  none: { label: 'None', t: 0, density: 0 },
  ply9: { label: 'Birch plywood 9 mm', t: 9, density: 680 },
  ply12: { label: 'Birch plywood 12 mm', t: 12, density: 680 },
  abs3: { label: 'ABS sheet 3 mm', t: 3, density: 1050 },
  hdpe6: { label: 'HDPE sheet 6 mm', t: 6, density: 950 },
  alu3: { label: 'Aluminium sheet 3 mm', t: 3, density: 2700 },
};

// Default bracket sizes: l along the face's first axis, w along the second, t = projection from face.
export const BRACKETS = {
  'lateral-swing': {
    label: 'Swing-away lateral bracket', l: 120, w: 40, t: 20, mass: 0.35,
    material: 'alu', fixing: 'M6', note: 'Swings clear of the user for transfers.',
  },
  'lateral-fixed': {
    label: 'Fixed lateral bracket', l: 100, w: 40, t: 15, mass: 0.25,
    material: 'alu', fixing: 'M6', note: '',
  },
  'headrest-mount': {
    label: 'Headrest mount (multi-axis)', l: 80, w: 60, t: 25, mass: 0.45,
    material: 'alu', fixing: 'M6', note: 'Height, depth and angle adjustable.',
  },
  'seat-hook': {
    label: 'Seat drop hook (J-hook)', l: 60, w: 30, t: 25, mass: 0.12,
    material: 'steel', fixing: 'M6', note: 'Hooks over wheelchair seat rails. Specify tube diameter.',
  },
  'back-hardware': {
    label: 'Back hardware clamp (quick-release)', l: 80, w: 40, t: 30, mass: 0.3,
    material: 'alu', fixing: 'M6', note: 'Clamps to back canes. Specify cane diameter.',
  },
  'qr-plate': {
    label: 'Quick-release plate and receiver', l: 100, w: 60, t: 10, mass: 0.2,
    material: 'alu', fixing: 'M5', note: '',
  },
  'tnut': {
    label: 'T-nut / threaded insert', l: 20, w: 20, t: 4, mass: 0.01,
    material: 'steel', fixing: 'M6', note: 'Set into base board.',
  },
  'hook-loop': {
    label: 'Hook-and-loop strip', l: 200, w: 50, t: 3, mass: 0.02,
    material: 'nylon', fixing: 'adhesive', note: '',
  },
  'strap': {
    label: 'Strap with side-release buckle', l: 300, w: 25, t: 3, mass: 0.05,
    material: 'nylon', fixing: 'sewn', note: '',
  },
  'hinge': {
    label: 'Hinge', l: 60, w: 40, t: 5, mass: 0.06,
    material: 'stainless', fixing: 'M5', note: '',
  },
  'custom': {
    label: 'Custom bracket', l: 60, w: 40, t: 10, mass: 0.1,
    material: 'alu', fixing: 'M6', note: '',
  },
};

export const BRACKET_MATERIALS = {
  alu: 'Aluminium (anodised)',
  steel: 'Mild steel (powder-coated)',
  stainless: 'Stainless steel 304',
  nylon: 'Nylon / acetal',
  ply: 'Plywood',
};

export const FIXINGS = {
  M5: 'M5 machine screws',
  M6: 'M6 machine screws',
  M8: 'M8 machine screws',
  wood: 'Wood screws',
  rivet: 'Rivets',
  adhesive: 'Adhesive',
  sewn: 'Sewn to cover',
};

// Faces are named in the assembly frame: X = width (left to right),
// Y = depth (front to back), Z = height (up).
export const FACES = {
  bottom: 'Bottom (−Z)',
  top: 'Top (+Z)',
  front: 'Front (−Y)',
  back: 'Back (+Y)',
  left: 'Left (−X)',
  right: 'Right (+X)',
};

export const COVER_MATERIALS = {
  none: { label: 'No cover', gsm: 0, waterproof: false, breathable: true },
  'pu-knit': { label: 'PU-coated knit (vapour-permeable)', gsm: 180, waterproof: true, breathable: true },
  vinyl: { label: 'PVC vinyl (wipe-clean)', gsm: 450, waterproof: true, breathable: false },
  spacer: { label: '3D spacer mesh', gsm: 350, waterproof: false, breathable: true },
  velour: { label: 'Stretch velour', gsm: 280, waterproof: false, breathable: true },
  neoprene: { label: 'Neoprene', gsm: 600, waterproof: true, breathable: false },
  incont: { label: 'Incontinence-proof laminate', gsm: 220, waterproof: true, breathable: true },
};

export const CLOSURES = {
  zip: 'Zip',
  'hook-loop': 'Hook-and-loop',
  envelope: 'Envelope / overlap',
  sewn: 'Sewn closed (not removable)',
};

export const FIRE_STANDARDS = {
  none: 'Not specified',
  bs7176: 'BS 7176 (medium hazard)',
  bs5852: 'BS 5852 crib 5',
  en1021: 'EN 1021-1 and -2',
  cal117: 'CAL TB 117-2013',
};

export const COVER_COLOURS = {
  '#2b2d2f': 'Black',
  '#4a5057': 'Charcoal',
  '#26375a': 'Navy',
  '#2f5fa6': 'Royal blue',
  '#6b2433': 'Burgundy',
  '#8b939b': 'Grey',
  '#cbb895': 'Beige',
  '#3f6b4f': 'Forest green',
};
