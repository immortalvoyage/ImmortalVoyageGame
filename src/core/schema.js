export const WORLD_SCHEMA_VERSION = 1;
export const SAVE_SCHEMA_VERSION = 1;
export const CORE_VERSION = "0.1.0";

export function getSchemaInfo() {
  return {
    coreVersion: CORE_VERSION,
    worldSchemaVersion: WORLD_SCHEMA_VERSION,
    saveSchemaVersion: SAVE_SCHEMA_VERSION
  };
}
