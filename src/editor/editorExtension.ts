import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	Decoration,
	WidgetType,
	MatchDecorator,
} from "@codemirror/view";
import type { DecorationSet, PluginValue } from "@codemirror/view";
import { hasGoodContrast } from "../utils/colorParser";
import type { IroViewSettings } from "../types";

// Regex
const HEX_SRC =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;
const RGB_SRC =
	/rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const HSL_SRC =
	/hsla?\(\s*(?:36[0]|3[0-5]\d|[12]?\d{1,2})\s*,\s*(?:100|\d{1,2})%\s*,\s*(?:100|\d{1,2})%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const COMBINED_SRC = [HEX_SRC, RGB_SRC, HSL_SRC].map((r) => r.source).join("|");

// Widget
export class ColorWidget extends WidgetType {
	constructor(
		readonly color: string,
		readonly originalText: string,
		readonly showSwatch: boolean,
		readonly colorizeText: boolean,
		readonly ignoreContrast: boolean,
	) {
		super();
	}

	eq(other: ColorWidget): boolean {
		return (
			this.color === other.color &&
			this.originalText === other.originalText &&
			this.showSwatch === other.showSwatch &&
			this.colorizeText === other.colorizeText &&
			this.ignoreContrast === other.ignoreContrast
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapper = createSpan();
		wrapper.className = "cp-color-inline";
		wrapper.setAttribute("aria-label", `Color: ${this.color}`);

		if (this.showSwatch) {
			const swatch = createSpan();
			swatch.className = "cp-color-swatch";
			swatch.setCssProps({ "--cp-swatch-color": this.color });
			wrapper.appendChild(swatch);
		}

		const label = createSpan();
		label.textContent = this.originalText;

		if (
			this.colorizeText &&
			hasGoodContrast(this.color, this.ignoreContrast)
		) {
			label.className = "cp-colored-text";
			label.setCssProps({ "--cp-text-color": this.color });
		}

		wrapper.appendChild(label);
		return wrapper;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// MatchDecorator
function makeDecorator(settings: IroViewSettings): MatchDecorator {
	return new MatchDecorator({
		regexp: new RegExp(COMBINED_SRC, "gi"),
		decoration: (match) =>
			Decoration.replace({
				widget: new ColorWidget(
					match[0],
					match[0],
					settings.showSwatchInEditor,
					settings.colorizeTextInEditor,
					settings.ignoreContrast,
				),
			}),
	});
}

export function createIroViewExtension(getSettings: () => IroViewSettings) {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;
			private decorator: MatchDecorator;
			private lastKey: string;

			constructor(view: EditorView) {
				const s = getSettings();
				this.lastKey = `${s.showSwatchInEditor}|${s.colorizeTextInEditor}|${s.ignoreContrast}`;
				this.decorator = makeDecorator(s);
				this.decorations = this.decorator.createDeco(view);
			}

			update(update: ViewUpdate) {
				const s = getSettings();
				const key = `${s.showSwatchInEditor}|${s.colorizeTextInEditor}|${s.ignoreContrast}`;

				if (key !== this.lastKey) {
					this.lastKey = key;
					this.decorator = makeDecorator(s);
					this.decorations = this.decorator.createDeco(update.view);
				} else if (update.docChanged || update.viewportChanged) {
					this.decorations = this.decorator.updateDeco(
						update,
						this.decorations,
					);
				}
			}

			destroy() {
				/* nothing to clean up */
			}
		},
		{ decorations: (v) => v.decorations },
	);
}
