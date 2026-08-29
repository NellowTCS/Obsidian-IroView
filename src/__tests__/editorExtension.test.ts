import { describe, it, expect } from "vitest";
import { ColorWidget } from "../editor/editorExtension";

const fakeView = {
	dom: { ownerDocument: document },
} as never;

function widget(
	color: string,
	opts: {
		showSwatch: boolean;
		colorizeText: boolean;
		ignoreContrast: boolean;
	},
): HTMLElement {
	return new ColorWidget(
		color,
		color,
		opts.showSwatch,
		opts.colorizeText,
		opts.ignoreContrast,
	).toDOM(fakeView);
}

describe("ColorWidget.toDOM", () => {
	it("renders a swatch when showSwatch is true", () => {
		const el = widget("#ff0000", {
			showSwatch: true,
			colorizeText: false,
			ignoreContrast: false,
		});
		expect(el.classList.contains("cp-color-inline")).toBe(true);
		expect(el.querySelector(".cp-color-swatch")).not.toBeNull();
	});

	it("omits the swatch when showSwatch is false", () => {
		const el = widget("#ff0000", {
			showSwatch: false,
			colorizeText: false,
			ignoreContrast: false,
		});
		expect(el.querySelector(".cp-color-swatch")).toBeNull();
	});

	it("colorizes text when colorizeText is on and contrast is good", () => {
		const el = widget("#000000", {
			showSwatch: false,
			colorizeText: true,
			ignoreContrast: false,
		});
		expect(el.querySelector(".cp-colored-text")).not.toBeNull();
	});

	it("does not colorize text when colorizeText is off", () => {
		const el = widget("#000000", {
			showSwatch: false,
			colorizeText: false,
			ignoreContrast: false,
		});
		expect(el.querySelector(".cp-colored-text")).toBeNull();
	});

	it("colorizes low-contrast text when ignoreContrast is on and colorizeText is on", () => {
		const el = widget("#ffffff", {
			showSwatch: false,
			colorizeText: true,
			ignoreContrast: true,
		});
		expect(el.querySelector(".cp-colored-text")).not.toBeNull();
	});

	it("does not colorize low-contrast text when ignoreContrast is off", () => {
		const el = widget("#ffffff", {
			showSwatch: false,
			colorizeText: true,
			ignoreContrast: false,
		});
		expect(el.querySelector(".cp-colored-text")).toBeNull();
	});

	it("always shows the swatch regardless of contrast or colorizeText", () => {
		const el = widget("#ffffff", {
			showSwatch: true,
			colorizeText: true,
			ignoreContrast: false,
		});
		expect(el.querySelector(".cp-color-swatch")).not.toBeNull();
	});
});
