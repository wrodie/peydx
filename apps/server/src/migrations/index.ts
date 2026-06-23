import * as migration_20260620_064437 from './20260620_064437';
import * as migration_20260622_000000_role_standard_manager from './20260622_000000_role_standard_manager';
import * as migration_20260620_064437 from './20260620_064437';
import * as migration_20260622_000000_role_standard_manager from './20260622_000000_role_standard_manager';
import * as migration_20260622_000001_migrate_basic_to_standard from './20260622_000001_migrate_basic_to_standard';
import * as migration_20260622_000002_add_updating_status from './20260622_000002_add_updating_status';

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
  {
    up: migration_20260622_000001_migrate_basic_to_standard.up,
    down: migration_20260622_000001_migrate_basic_to_standard.down,
    name: '20260622_000001_migrate_basic_to_standard'
  },
  {
    up: migration_20260622_000002_add_updating_status.up,
    down: migration_20260622_000002_add_updating_status.down,
    name: '20260622_000002_add_updating_status'
  },
];
