import type { LabelPreset } from "$/types";

/** Random id. crypto.randomUUID is unavailable in insecure contexts (plain http), so fall back. */
export const makePresetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Make sure every preset has a unique id (ids from imports may collide with existing ones).
 * Returns the same array and `changed = false` when nothing had to be assigned.
 */
export const ensurePresetIds = (presets: LabelPreset[]): { presets: LabelPreset[]; changed: boolean } => {
  const seen = new Set<string>();
  let changed = false;

  const result = presets.map((preset) => {
    if (preset.id !== undefined && !seen.has(preset.id)) {
      seen.add(preset.id);
      return preset;
    }

    let id = makePresetId();
    while (seen.has(id)) id = makePresetId();
    seen.add(id);
    changed = true;
    return { ...preset, id };
  });

  return { presets: changed ? result : presets, changed };
};
