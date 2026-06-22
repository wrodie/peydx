import * as migration_20260620_064437 from './20260620_064437';
import * as migration_20260622_000000_role_standard_manager from './20260622_000000_role_standard_manager';

export const migrations = [
  {
    up: migration_20260620_064437.up,
    down: migration_20260620_064437.down,
    name: '20260620_064437'
  },
  {
    up: migration_20260622_000000_role_standard_manager.up,
    down: migration_20260622_000000_role_standard_manager.down,
    name: '20260622_000000_role_standard_manager'
  },
];
