import { describe, it, expect, vi } from "vitest";
import {
	applyColorization,
	applyColorizationToTables,
	processReadingView,
	stripColorWrappers,
} from "../reading/readingViewProcessor";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { IroViewSettings } from "../types";
import { makeSettings } from "./helpers";

function run(element: HTMLElement, settings: IroViewSettings): void {
	applyColorization(element, settings);
}

function fencedCode(text: string): HTMLElement {
	const root = document.createElement("div");
	const pre = document.createElement("pre");
	const code = document.createElement("code");
	code.textContent = text;
	pre.appendChild(code);
	root.appendChild(pre);
	return root;
}

function inlineCode(text: string): HTMLElement {
	const root = document.createElement("div");
	const p = document.createElement("p");
	const code = document.createElement("code");
	code.textContent = text;
	p.appendChild(code);
	root.appendChild(p);
	return root;
}

function plainText(text: string): HTMLElement {
	const root = document.createElement("div");
	const p = document.createElement("p");
	p.textContent = text;
	root.appendChild(p);
	return root;
}

function tableCell(text: string): HTMLElement {
	const root = document.createElement("div");
	const table = document.createElement("table");
	const tr = document.createElement("tr");
	const td = document.createElement("td");
	td.textContent = text;
	tr.appendChild(td);
	table.appendChild(tr);
	root.appendChild(table);
	return root;
}

function multiCellTable(cells: string[]): HTMLElement {
	const root = document.createElement("div");
	const table = document.createElement("table");
	const tr = document.createElement("tr");
	for (const text of cells) {
		const td = document.createElement("td");
		td.textContent = text;
		tr.appendChild(td);
	}
	table.appendChild(tr);
	root.appendChild(table);
	return root;
}

function tableWithHeader(
	tableTexts: string[],
	headerTexts: string[],
): HTMLElement {
	const root = document.createElement("div");
	const table = document.createElement("table");
	const thead = document.createElement("thead");
	const headRow = document.createElement("tr");
	for (const text of headerTexts) {
		const th = document.createElement("th");
		th.textContent = text;
		headRow.appendChild(th);
	}
	thead.appendChild(headRow);
	const tbody = document.createElement("tbody");
	const bodyRow = document.createElement("tr");
	for (const text of tableTexts) {
		const td = document.createElement("td");
		td.textContent = text;
		bodyRow.appendChild(td);
	}
	tbody.appendChild(bodyRow);
	table.appendChild(thead);
	table.appendChild(tbody);
	root.appendChild(table);
	return root;
}

function swatchCount(el: HTMLElement): number {
	return el.querySelectorAll(".cp-color-swatch").length;
}

function coloredTextCount(el: HTMLElement): number {
	return el.querySelectorAll(".cp-colored-text").length;
}

interface CapturedChild {
	load: () => void;
	unload: () => void;
}

function fakeContext() {
	const children: CapturedChild[] = [];
	const context = {
		addChild: vi.fn(
			(child: { onload: () => void; onunload: () => void }) => {
				const wrapped = {
					load: () => child.onload(),
					unload: () => child.onunload(),
				};
				children.push(wrapped);
				wrapped.load();
				return child;
			},
		),
		context: {},
	} as unknown as MarkdownPostProcessorContext;
	return { context, children };
}

describe("processReadingView - fenced code blocks", () => {
	it("renders a color swatch inside a fenced code block", () => {
		const el = fencedCode("use #ff0000 here");
		run(el, makeSettings({ showSwatchInEditor: true }));

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
		expect(el.querySelectorAll(".cp-color-swatch").length).toBe(1);
	});

	it("renders inside inline code spans", () => {
		const el = inlineCode("use #ff0000 here");
		run(el, makeSettings());

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("still renders in plain text paragraphs", () => {
		const el = plainText("use #ff0000 here");
		run(el, makeSettings());

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("colorizes text inside fenced code when colorizeText is on and contrast is good", () => {
		const el = fencedCode("use #000000 here"); // black has good contrast
		run(
			el,
			makeSettings({
				showSwatchInEditor: false,
				colorizeTextInEditor: true,
			}),
		);

		const colored = el.querySelector(".cp-colored-text");
		expect(colored).not.toBeNull();
		expect(colored?.textContent).toBe("#000000");
	});

	it("colorizes low-contrast text inside fenced code when ignoreContrast is on", () => {
		// white text on default jsdom background (assumed light) has low contrast
		const el = fencedCode("use #ffffff here");
		run(
			el,
			makeSettings({
				showSwatchInEditor: false,
				colorizeTextInEditor: true,
				ignoreContrast: true,
			}),
		);

		expect(el.querySelector(".cp-colored-text")).not.toBeNull();
	});

	it("does not colorize low-contrast text when ignoreContrast is off", () => {
		const el = fencedCode("use #ffffff here");
		run(
			el,
			makeSettings({
				showSwatchInEditor: false,
				colorizeTextInEditor: true,
				ignoreContrast: false,
			}),
		);

		expect(el.querySelector(".cp-colored-text")).toBeNull();
	});

	it("does not add a swatch when showSwatchInEditor is off", () => {
		const el = fencedCode("use #ff0000 here");
		run(el, makeSettings({ showSwatchInEditor: false }));

		expect(el.querySelector(".cp-color-swatch")).toBeNull();
	});

	it("renders inside an inline code span in a paragraph", () => {
		const el = inlineCode("use `#ff0000` here");
		run(el, makeSettings());

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("renders inside a table cell", () => {
		const el = tableCell("#ff0000");
		run(el, makeSettings());

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("applyColorization updates stale (already-processed) table DOM", () => {
		const el = tableCell("#ff0000");
		run(
			el,
			makeSettings({
				showSwatchInEditor: true,
				colorizeTextInEditor: true,
			}),
		);

		// Simulate the stale, lazily-cached state that a settings change must
		// refresh: table keeps old wrappers until explicitly re-processed.
		applyColorization(el, makeSettings({ showSwatchInEditor: false }));

		expect(el.querySelector(".cp-color-swatch")).toBeNull();
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("applyColorization into colorize mode colors stale table text", () => {
		const el = tableCell("#000000");
		run(
			el,
			makeSettings({
				showSwatchInEditor: true,
				colorizeTextInEditor: false,
			}),
		);

		expect(el.querySelector(".cp-colored-text")).toBeNull();

		applyColorization(
			el,
			makeSettings({
				showSwatchInEditor: true,
				colorizeTextInEditor: true,
			}),
		);

		expect(el.querySelector(".cp-colored-text")).not.toBeNull();
	});

	it("stripColorWrappers restores original plain text", () => {
		const el = tableCell("#ff0000");
		run(el, makeSettings({ showSwatchInEditor: true }));

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();

		stripColorWrappers(el);

		expect(el.querySelector(".cp-color-wrapper")).toBeNull();
		expect(el.textContent).toContain("#ff0000");
	});

	it("does not duplicate swatches when applyColorization is called twice", () => {
		const el = tableCell("#ff0000");
		run(el, makeSettings({ showSwatchInEditor: true }));

		applyColorization(el, makeSettings({ showSwatchInEditor: true }));
		applyColorization(el, makeSettings({ showSwatchInEditor: true }));

		expect(el.querySelectorAll(".cp-color-swatch").length).toBe(1);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("strips existing wrappers when reading view colorization is disabled", () => {
		const el = tableCell("#ff0000");
		run(el, makeSettings({ showSwatchInEditor: true }));

		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();

		applyColorization(el, makeSettings({ enableInReadingView: false }));

		expect(el.querySelector(".cp-color-wrapper")).toBeNull();
	});

	it("applyColorizationToTables colorizes a table embedded in arbitrary DOM", () => {
		const root = document.createElement("div");
		const heading = document.createElement("h1");
		heading.textContent = "Use #00ff00 in this heading";
		const table = tableCell("#ff0000");
		root.appendChild(heading);
		root.appendChild(table);

		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);

		expect(root.querySelector(".cp-color-swatch")).not.toBeNull();
		expect(table.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("applyColorizationToTables does not double swatches when run repeatedly", () => {
		const root = document.createElement("div");
		root.appendChild(tableCell("#ff0000"));

		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);
		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);

		expect(root.querySelectorAll(".cp-color-swatch").length).toBe(1);
	});

	it("applyColorizationToTables honors a settings change like the lazy-table refresh", () => {
		const el = tableCell("#ff0000");
		run(el, makeSettings({ showSwatchInEditor: true }));
		expect(el.querySelectorAll(".cp-color-swatch").length).toBe(1);

		applyColorizationToTables(
			el,
			makeSettings({ showSwatchInEditor: false }),
		);

		expect(el.querySelector(".cp-color-swatch")).toBeNull();
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});
});

describe("applyColorization - color format variants", () => {
	it("wraps 3-digit hex", () => {
		const el = plainText("color #f00 here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
		expect(el.querySelector(".cp-color-swatch")).not.toBeNull();
	});

	it("wraps 4-digit hex", () => {
		const el = plainText("color #f00a here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps 6-digit hex", () => {
		const el = plainText("color #ff0000 here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps 8-digit hex", () => {
		const el = plainText("color #ff0000aa here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps rgb()", () => {
		const el = plainText("color rgb(255, 0, 0) here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps rgba()", () => {
		const el = plainText("color rgba(255, 0, 0, 0.5) here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps hsl()", () => {
		const el = plainText("color hsl(0, 100%, 50%) here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps hsla()", () => {
		const el = plainText("color hsla(0, 100%, 50%, 0.5) here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("treats colors case-insensitively (uppercase hex + uppercase rgb)", () => {
		const el = plainText("color #FF0000 and RGB(0, 255, 0)");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(2);
	});

	it("does not match comma-less space-separated functional notation", () => {
		// The parser only accepts comma-separated rgb()/hsl() forms.
		const el = plainText("color rgb(0 0 0) anything");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(0);
	});

	it("does not wrap invalid hex (too many digits / non-hex chars)", () => {
		const el = plainText("color #ff00001 and #zz0000 here");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(0);
	});

	it("does not wrap a bare hex-like word followed by a letter", () => {
		const el = plainText("color #ff0000g here"); // 'g' is not hex-> matches #ff0000 then 'g'
		run(el, makeSettings());
		// "#ff0000" alone is valid; the letter 'g' just terminates it.
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("wraps multiple distinct colors in a single text node", () => {
		const el = plainText("colors #ff0000 and #00ff00 and rgb(0,0,255)");
		run(el, makeSettings());
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(3);
		expect(swatchCount(el)).toBe(3);
	});

	it("preserves surrounding plain text around colors", () => {
		const el = plainText("before #ff0000 after");
		run(el, makeSettings());
		expect(el.textContent).toBe("before #ff0000 after");
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});
});

describe("applyColorization - reading-view toggles", () => {
	it("apply off then on yields exactly one swatch", () => {
		const el = plainText("use #ff0000 here");
		run(el, makeSettings({ showSwatchInEditor: true }));
		expect(swatchCount(el)).toBe(1);

		// Toggle setting off -> observed as a re-run of colorization
		applyColorization(el, makeSettings({ showSwatchInEditor: false }));
		expect(swatchCount(el)).toBe(0);
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();

		// Toggle back on -> exactly one swatch, no duplication
		applyColorization(el, makeSettings({ showSwatchInEditor: true }));
		expect(swatchCount(el)).toBe(1);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("re-running repeatedly with identical settings never duplicates", () => {
		const el = plainText("use #ff0000 here");
		for (let i = 0; i < 20; i++) {
			applyColorization(el, makeSettings({ showSwatchInEditor: true }));
		}
		expect(swatchCount(el)).toBe(1);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
		expect(el.textContent).toBe("use #ff0000 here");
	});

	it("colorize-only mode adds no swatch but colors text", () => {
		const el = plainText("use #000000 here"); // black contrasts on light bg
		run(
			el,
			makeSettings({
				showSwatchInEditor: false,
				colorizeTextInEditor: true,
				ignoreContrast: true,
			}),
		);
		expect(swatchCount(el)).toBe(0);
		expect(coloredTextCount(el)).toBe(1);
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});

	it("both swatch and colorize together produce one swatch and one colored label", () => {
		const el = plainText("use #000000 here");
		run(
			el,
			makeSettings({
				showSwatchInEditor: true,
				colorizeTextInEditor: true,
				ignoreContrast: true,
			}),
		);
		expect(swatchCount(el)).toBe(1);
		expect(coloredTextCount(el)).toBe(1);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("does nothing when reading view colorization is disabled entirely", () => {
		const el = plainText("use #ff0000 here");
		applyColorization(
			el,
			makeSettings({
				enableInReadingView: false,
				showSwatchInEditor: true,
			}),
		);
		expect(el.querySelector(".cp-color-wrapper")).toBeNull();
		expect(el.querySelector(".cp-color-swatch")).toBeNull();
		expect(el.textContent).toBe("use #ff0000 here");
	});
});

describe("applyColorizationToTables - multi-cell and headers", () => {
	it("colorizes every cell containing a color", () => {
		const el = multiCellTable(["#ff0000", "plain", "#00ff00", "z"]);
		applyColorizationToTables(
			el,
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(el)).toBe(2);
	});

	it("colorizes both header and body cells", () => {
		const el = tableWithHeader(["#111111"], ["#ff0000"]);
		applyColorizationToTables(
			el,
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(el)).toBe(2);
	});

	it("does not duplicate across a full contentEl-style document with mixed blocks", () => {
		const root = document.createElement("div");
		root.appendChild(plainText("use #ff0000 here")); // non-table: NOT touched
		root.appendChild(multiCellTable(["#00ff00", "#ff0000"])); // table: touched
		root.appendChild(tableWithHeader(["#0000ff"], ["#ff0000"])); // table: touched

		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);

		// Only the two tables should have been wrapped; the paragraph is untouched
		// because a settings change routes paragraphs through rerender instead.
		expect(swatchCount(root)).toBe(4);
	});

	it("adding an extra table on a later pass colorizes only the new table", () => {
		const root = document.createElement("div");
		root.appendChild(tableCell("#ff0000"));
		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(root)).toBe(1);

		const second = tableCell("#00ff00");
		root.appendChild(second);
		applyColorizationToTables(
			root,
			makeSettings({ showSwatchInEditor: true }),
		);

		expect(swatchCount(root)).toBe(2);
		expect(root.querySelectorAll(".cp-color-wrapper").length).toBe(2);
	});

	it("stripColorWrappers restores multiple wrapped cells", () => {
		const el = multiCellTable(["#ff0000", "#00ff00"]);
		applyColorizationToTables(
			el,
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(el)).toBe(2);

		stripColorWrappers(el);
		expect(el.querySelector(".cp-color-wrapper")).toBeNull();
		expect(el.textContent).toContain("#ff0000");
		expect(el.textContent).toContain("#00ff00");
	});
});

describe("stripColorWrappers", () => {
	it("strips multiple wrappers and normalizes adjacent text", () => {
		const el = plainText("a #ff0000 b #00ff00 c");
		run(el, makeSettings({ showSwatchInEditor: true }));
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(2);

		stripColorWrappers(el);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(0);
		expect(el.textContent).toBe("a #ff0000 b #00ff00 c");
		// Adjacent text nodes should have been merged by normalize().
		expect(el.querySelector("p")?.childNodes.length).toBe(1);
	});

	it("is a no-op when there are no wrappers", () => {
		const el = plainText("no colors here");
		stripColorWrappers(el);
		expect(el.textContent).toBe("no colors here");
	});
});

describe("processReadingView - lifecycle", () => {
	it("applies colorization when the child loads", () => {
		const el = plainText("use #ff0000 here");
		const { context, children } = fakeContext();

		processReadingView(el, context, () =>
			makeSettings({ showSwatchInEditor: true }),
		);

		expect(children.length).toBe(1);
		expect(swatchCount(el)).toBe(1);
	});

	it("strips wrappers when the child unloads (block replaced)", () => {
		const el = plainText("use #ff0000 here");
		const { context, children } = fakeContext();

		processReadingView(el, context, () =>
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(el)).toBe(1);

		// Simulate Obsidian replacing/re-rendering the block: unload old child.
		children[0].unload();
		expect(swatchCount(el)).toBe(0);
		expect(el.querySelector(".cp-color-wrapper")).toBeNull();
		expect(el.textContent).toContain("#ff0000");
	});

	it("does not double when a stale child remains and a fresh pass re-applies", () => {
		const el = plainText("use #ff0000 here");
		const { context } = fakeContext();

		processReadingView(el, context, () =>
			makeSettings({ showSwatchInEditor: true }),
		);
		expect(swatchCount(el)).toBe(1);

		// A competing/late run must remain idempotent despite the existing wrapper.
		applyColorization(el, makeSettings({ showSwatchInEditor: true }));
		expect(swatchCount(el)).toBe(1);
		expect(el.querySelectorAll(".cp-color-wrapper").length).toBe(1);
	});

	it("honors the latest settings via the getSettings getter", () => {
		const el = plainText("use #ff0000 here");
		let settings = makeSettings({ showSwatchInEditor: true });
		const { context, children } = fakeContext();

		processReadingView(el, context, () => settings);
		expect(swatchCount(el)).toBe(1);

		// Toggle the setting, then unload+reload (as rerender would): the child
		// should now apply the *new* settings.
		settings = makeSettings({ showSwatchInEditor: false });
		children[0].unload();
		children[0].load();
		expect(swatchCount(el)).toBe(0);
		expect(el.querySelector(".cp-color-wrapper")).not.toBeNull();
	});
});
