import { MarkdownRenderChild } from "obsidian";
import { findColorsInText, hasGoodContrast } from "../utils/colorParser";
import type { IroViewSettings } from "../types";
import type { MarkdownPostProcessorContext } from "obsidian";

/**
 * Replace all previously created color wrappers inside `root` with plain text,
 * normalizing the DOM back to its original state.
 */
export function stripColorWrappers(root: HTMLElement): void {
	root.querySelectorAll(".cp-color-wrapper").forEach((wrapper) => {
		const doc = wrapper.ownerDocument ?? window.activeDocument;
		wrapper.replaceWith(doc.createTextNode(wrapper.textContent ?? ""));
	});
	root.normalize();
}

/**
 * Re-scan `root` and colorize any color values found in it, replacing plain
 * text nodes with swatch/text wrappers according to the current settings.
 * Existing wrappers are stripped first so this is idempotent and safe to call
 * on already-processed, lazily-cached DOM
 */
export function applyColorization(
	root: HTMLElement,
	settings: IroViewSettings,
): void {
	// Always strip existing wrappers first so re-running this is idempotent
	stripColorWrappers(root);

	if (!settings.enableInReadingView) return;

	const nodes: Text[] = [];
	const walker = root.ownerDocument.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) => {
				if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
				const parent = (node as Text).parentElement;
				if (parent?.closest(".cp-color-wrapper"))
					return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		},
	);
	let n: Node | null;
	while ((n = walker.nextNode())) nodes.push(n as Text);

	for (const node of nodes) {
		const text = node.nodeValue ?? "";
		const matches = findColorsInText(text);
		if (matches.length === 0) continue;

		const fragment = root.ownerDocument.createDocumentFragment();
		let cursor = 0;
		for (const match of matches) {
			if (match.from > cursor) {
				fragment.appendChild(
					root.ownerDocument.createTextNode(
						text.slice(cursor, match.from),
					),
				);
			}
			fragment.appendChild(createColorElement(settings, match.color));
			cursor = match.to;
		}
		if (cursor < text.length) {
			fragment.appendChild(
				root.ownerDocument.createTextNode(text.slice(cursor)),
			);
		}
		node.parentNode?.replaceChild(fragment, node);
	}
}

function createColorElement(
	settings: IroViewSettings,
	color: string,
): HTMLElement {
	const doc = window.activeDocument ?? document;
	const wrapper = doc.createElement("span");
	wrapper.className = "cp-color-wrapper";

	if (settings.showSwatchInEditor) {
		const swatch = doc.createElement("span");
		swatch.className = "cp-color-swatch";
		swatch.setAttribute("aria-label", `Color: ${color}`);
		swatch.setCssProps({ "--cp-swatch-color": color });
		wrapper.appendChild(swatch);
	}

	const label = doc.createElement("span");
	label.textContent = color;

	if (
		settings.colorizeTextInEditor &&
		hasGoodContrast(color, settings.ignoreContrast)
	) {
		label.className = "cp-colored-text";
		label.setCssProps({ "--cp-text-color": color });
		// Set the color directly and importantly so it isn't overridden by
		// theme rules on some contexts (e.g. table cells).
		label.style.setProperty("color", color, "important");
	}

	wrapper.appendChild(label);
	return wrapper;
}

class ColorSpanChild extends MarkdownRenderChild {
	constructor(
		element: HTMLElement,
		private readonly settings: IroViewSettings,
	) {
		super(element);
	}

	onload(): void {
		applyColorization(this.containerEl, this.settings);
	}

	onunload(): void {
		stripColorWrappers(this.containerEl);
	}
}

export function processReadingView(
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
	settings: IroViewSettings,
): void {
	context.addChild(new ColorSpanChild(element, settings));
}
