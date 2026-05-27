import * as migration_20260526_020612 from './20260526_020612';

export const migrations = [
  {
    up: migration_20260526_020612.up,
    down: migration_20260526_020612.down,
    name: '20260526_020612'
  },
];
