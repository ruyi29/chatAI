export type VisualTheme = "light" | "dark" | "system";
export type VisualDensity = "comfortable" | "compact";
export type VisualAccent = "emerald" | "blue" | "violet" | "coral" | "rose" | "champagne";
export type VisualMotionLevel = "full" | "subtle" | "reduced";
export type VisualMood = "cyber" | "fusion" | "soft";

export interface VisualPreset {
  id: string;
  name: string;
  theme: VisualTheme;
  density: VisualDensity;
  accent: VisualAccent;
  motionLevel: VisualMotionLevel;
  visualMood: VisualMood;
  softIntensity: number;
  particlesEnabled: boolean;
  particleIntensity: number;
}

export type VisualPresetDraft = Omit<VisualPreset, "id"> & { id?: string };

export interface VisualPresetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SaveVisualPresetResult =
  | { ok: true; preset: VisualPreset; presets: VisualPreset[] }
  | {
      ok: false;
      reason: "invalid-preset" | "limit-reached" | "storage-unavailable";
      presets: VisualPreset[];
    };

export type RemoveVisualPresetResult =
  | { ok: true; presets: VisualPreset[] }
  | {
      ok: false;
      reason: "not-found" | "storage-unavailable";
      presets: VisualPreset[];
    };

export const CUSTOM_VISUAL_PRESETS_STORAGE_KEY = "chatai-custom-visual-presets";
export const MAX_CUSTOM_VISUAL_PRESETS = 12;
export const MAX_VISUAL_PRESET_NAME_LENGTH = 20;

const themes = ["light", "dark", "system"] as const;
const densities = ["comfortable", "compact"] as const;
const accents = ["emerald", "blue", "violet", "coral", "rose", "champagne"] as const;
const motionLevels = ["full", "subtle", "reduced"] as const;
const visualMoods = ["cyber", "fusion", "soft"] as const;

export const BUILT_IN_VISUAL_PRESETS: ReadonlyArray<Readonly<VisualPreset>> = Object.freeze([
  Object.freeze({
    id: "builtin-default-cyber",
    name: "默认科技",
    theme: "system",
    density: "comfortable",
    accent: "emerald",
    motionLevel: "full",
    visualMood: "cyber",
    softIntensity: 55,
    particlesEnabled: true,
    particleIntensity: 45
  }),
  Object.freeze({
    id: "builtin-nebula-fusion",
    name: "星云融合",
    theme: "dark",
    density: "comfortable",
    accent: "violet",
    motionLevel: "full",
    visualMood: "fusion",
    softIntensity: 62,
    particlesEnabled: true,
    particleIntensity: 72
  }),
  Object.freeze({
    id: "builtin-champagne-soft",
    name: "香槟柔光",
    theme: "light",
    density: "comfortable",
    accent: "champagne",
    motionLevel: "subtle",
    visualMood: "soft",
    softIntensity: 74,
    particlesEnabled: true,
    particleIntensity: 28
  })
] satisfies VisualPreset[]);

const defaultPreset = BUILT_IN_VISUAL_PRESETS[0];
const builtInPresetIds = new Set(BUILT_IN_VISUAL_PRESETS.map((preset) => preset.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readChoice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}

function clampPercentage(value: unknown, fallback: number): number {
  const numericValue = typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

export function normalizeVisualPresetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmedName = value.trim();
  if (!trimmedName) return null;
  return Array.from(trimmedName).slice(0, MAX_VISUAL_PRESET_NAME_LENGTH).join("").trim() || null;
}

function normalizePresetId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id) ? id : null;
}

function hashSeed(seed: string, initialValue: number): string {
  let hash = initialValue >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Produces the same storage-safe id for the same seed. */
export function createVisualPresetId(seed: string | number): string {
  const normalizedSeed = String(seed);
  return `custom-${hashSeed(normalizedSeed, 2166136261)}-${hashSeed(normalizedSeed, 3339675911)}`;
}

/** Convenience wrapper for creating a new id in the browser. */
export function generateVisualPresetId(): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return createVisualPresetId(`${Date.now()}:${randomPart}`);
}

function resolveStorage(storage: VisualPresetStorage | null | undefined): VisualPresetStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function extractPresetList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.presets)) return value.presets;
  if (Array.isArray(value.customPresets)) return value.customPresets;
  return [];
}

function normalizePreset(value: unknown, index: number, fallbackId?: string): VisualPreset | null {
  if (!isRecord(value)) return null;
  const name = normalizeVisualPresetName(value.name);
  if (!name) return null;

  const storedId = normalizePresetId(value.id);
  const legacySeed = [index, name, value.theme, value.accent, value.visualMood ?? value.mood].join(":");
  const id = fallbackId ?? storedId ?? createVisualPresetId(`legacy:${legacySeed}`);

  return {
    id,
    name,
    theme: readChoice(value.theme, themes, defaultPreset.theme),
    density: readChoice(value.density, densities, defaultPreset.density),
    accent: readChoice(value.accent, accents, defaultPreset.accent),
    motionLevel: readChoice(value.motionLevel ?? value.motion, motionLevels, defaultPreset.motionLevel),
    visualMood: readChoice(value.visualMood ?? value.mood, visualMoods, defaultPreset.visualMood),
    softIntensity: clampPercentage(value.softIntensity ?? value.softness, defaultPreset.softIntensity),
    particlesEnabled: typeof (value.particlesEnabled ?? value.particleEnabled) === "boolean"
      ? Boolean(value.particlesEnabled ?? value.particleEnabled)
      : defaultPreset.particlesEnabled,
    particleIntensity: clampPercentage(
      value.particleIntensity ?? value.particleStrength,
      defaultPreset.particleIntensity
    )
  };
}

function normalizePresetList(values: unknown[]): VisualPreset[] {
  const presets: VisualPreset[] = [];
  const ids = new Set<string>();

  for (let index = 0; index < values.length && presets.length < MAX_CUSTOM_VISUAL_PRESETS; index += 1) {
    const candidate = normalizePreset(values[index], index);
    if (!candidate) continue;

    let id = candidate.id;
    if (builtInPresetIds.has(id) || ids.has(id)) {
      id = createVisualPresetId(`recovered:${index}:${candidate.name}:${id}`);
    }
    while (builtInPresetIds.has(id) || ids.has(id)) {
      id = createVisualPresetId(`${id}:${index}`);
    }

    ids.add(id);
    presets.push({ ...candidate, id });
  }

  return presets;
}

export function loadCustomVisualPresets(storage?: VisualPresetStorage | null): VisualPreset[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    const rawValue = target.getItem(CUSTOM_VISUAL_PRESETS_STORAGE_KEY);
    if (!rawValue) return [];
    return normalizePresetList(extractPresetList(JSON.parse(rawValue)));
  } catch {
    return [];
  }
}

function persistCustomVisualPresets(
  presets: VisualPreset[],
  storage?: VisualPresetStorage | null
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.setItem(CUSTOM_VISUAL_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export function saveCustomVisualPreset(
  draft: VisualPresetDraft,
  storage?: VisualPresetStorage | null
): SaveVisualPresetResult {
  const presets = loadCustomVisualPresets(storage);
  const requestedId = normalizePresetId(draft?.id);
  const existingIndex = requestedId === null ? -1 : presets.findIndex((preset) => preset.id === requestedId);
  if (existingIndex < 0 && presets.length >= MAX_CUSTOM_VISUAL_PRESETS) {
    return { ok: false, reason: "limit-reached", presets };
  }

  let id = existingIndex >= 0 ? presets[existingIndex].id : generateVisualPresetId();
  const occupiedIds = new Set([...builtInPresetIds, ...presets.map((preset) => preset.id)]);
  while (existingIndex < 0 && occupiedIds.has(id)) {
    id = generateVisualPresetId();
  }

  const preset = normalizePreset(draft, existingIndex >= 0 ? existingIndex : presets.length, id);
  if (!preset) return { ok: false, reason: "invalid-preset", presets };

  const nextPresets = [...presets];
  if (existingIndex >= 0) nextPresets.splice(existingIndex, 1, preset);
  else nextPresets.unshift(preset);

  if (!persistCustomVisualPresets(nextPresets, storage)) {
    return { ok: false, reason: "storage-unavailable", presets };
  }
  return { ok: true, preset, presets: nextPresets };
}

export function removeCustomVisualPreset(
  id: string,
  storage?: VisualPresetStorage | null
): RemoveVisualPresetResult {
  const presets = loadCustomVisualPresets(storage);
  const nextPresets = presets.filter((preset) => preset.id !== id);
  if (nextPresets.length === presets.length) return { ok: false, reason: "not-found", presets };
  return persistCustomVisualPresets(nextPresets, storage)
    ? { ok: true, presets: nextPresets }
    : { ok: false, reason: "storage-unavailable", presets };
}
