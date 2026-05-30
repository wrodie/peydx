import * as migration_20260526_020612 from './20260526_020612.json';

const m = migration_20260526_020612 as any

export const migrations = [
  {
    up: m.up,
    down: m.down,
    name: '20260526_020612'
  },
];
