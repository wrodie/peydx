import * as migration_20260620_064437 from './20260620_064437';
import * as migration_20260622_000000_role_standard_manager from './20260622_000000_role_standard_manager';
import * as migration_20260622_000001_migrate_basic_to_standard from './20260622_000001_migrate_basic_to_standard';
import * as migration_20260622_000002_add_updating_status from './20260622_000002_add_updating_status';
import * as migration_20260622_000003_add_client_version_column from './20260622_000003_add_client_version_column';
import * as migration_20260625_media_fk_cascade from './20260625_media_fk_cascade';
import * as migration_20260703_000000_add_scale_to_fill from './20260703_000000_add_scale_to_fill';
import * as migration_20260709_000000_add_schedule_priority from './20260709_000000_add_schedule_priority';
import * as migration_20260709_000001_add_schedule_tz_columns from './20260709_000001_add_schedule_tz_columns';
import * as migration_20260724_000000_create_slides from './20260724_000000_create_slides';

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
  {
    up: migration_20260622_000003_add_client_version_column.up,
    down: migration_20260622_000003_add_client_version_column.down,
    name: '20260622_000003_add_client_version_column'
  },
  {
    up: migration_20260625_media_fk_cascade.up,
    down: migration_20260625_media_fk_cascade.down,
    name: '20260625_media_fk_cascade'
  },
  {
    up: migration_20260703_000000_add_scale_to_fill.up,
    down: migration_20260703_000000_add_scale_to_fill.down,
    name: '20260703_000000_add_scale_to_fill'
  },
  {
    up: migration_20260709_000000_add_schedule_priority.up,
    down: migration_20260709_000000_add_schedule_priority.down,
    name: '20260709_000000_add_schedule_priority'
  },
  {
    up: migration_20260709_000001_add_schedule_tz_columns.up,
    down: migration_20260709_000001_add_schedule_tz_columns.down,
    name: '20260709_000001_add_schedule_tz_columns'
  },
  {
    up: migration_20260724_000000_create_slides.up,
    down: migration_20260724_000000_create_slides.down,
    name: '20260724_000000_create_slides'
  },
];
