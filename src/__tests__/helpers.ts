import type { IroViewSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export function makeSettings(
	overrides: Partial<IroViewSettings> = {},
): IroViewSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}
