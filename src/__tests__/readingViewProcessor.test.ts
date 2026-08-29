import { describe, it, expect } from "vitest";
import type { MarkdownRenderChild } from "obsidian";

import {
	applyColorization,
	processReadingView,
	stripColorWrappers,
} from "../reading/readingViewProcessor";
import type { IroViewSettings } from "../types";
import { makeSettings } from "./helpers";

interface FakeContext {
	addChild(child: MarkdownRenderChild): void;
}

function run(element: HTMLElement, settings: IroViewSettings): FakeContext {
	const context: FakeContext = {
		addChild(child) {
			// Obsidian registers the child and calls its onload().
			child.onload();
		},
	};
	processReadingView(element, context as never, settings);
	return context;
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
});
