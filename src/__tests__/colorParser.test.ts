import { describe, it, expect } from "vitest";
import {
	findColorsInText,
	isValidColor,
	hasGoodContrast,
} from "../utils/colorParser";

describe("isValidColor", () => {
	it("accepts hex in all supported lengths", () => {
		expect(isValidColor("#f00")).toBe(true);
		expect(isValidColor("#f00a")).toBe(true);
		expect(isValidColor("#ff0000")).toBe(true);
		expect(isValidColor("#ff000080")).toBe(true);
		// 4-digit #RGBA form
		expect(isValidColor("#ff00")).toBe(true);
		expect(isValidColor("#fa0f")).toBe(true);
	});

	it("accepts uppercase and mixed-case hex", () => {
		expect(isValidColor("#FF0000")).toBe(true);
		expect(isValidColor("#FfAaBb")).toBe(true);
	});

	it("rejects non-hex characters and overlong hex", () => {
		expect(isValidColor("#fg0000")).toBe(false);
		expect(isValidColor("#ff00000")).toBe(false);
	});

	it("validates rgb and rgba", () => {
		expect(isValidColor("rgb(255, 0, 0)")).toBe(true);
		expect(isValidColor("rgba(255, 0, 0, 0.5)")).toBe(true);
		expect(isValidColor("rgba(255, 0, 0, 0)")).toBe(true);
		expect(isValidColor("rgba(255, 0, 0, 1)")).toBe(true);
	});

	it("rejects out-of-range rgb values", () => {
		expect(isValidColor("rgb(256, 0, 0)")).toBe(false);
		expect(isValidColor("rgb(-1, 0, 0)")).toBe(false);
		expect(isValidColor("rgb(255, 0)")).toBe(false);
	});

	it("validates hsl and hsla", () => {
		expect(isValidColor("hsl(120, 100%, 50%)")).toBe(true);
		expect(isValidColor("hsla(120, 100%, 50%, 0.5)")).toBe(true);
	});

	it("rejects hsl out of range", () => {
		expect(isValidColor("hsl(361, 100%, 50%)")).toBe(false);
		expect(isValidColor("hsl(120, 101%, 50%)")).toBe(false);
		expect(isValidColor("hsl(120, 100%, 101%)")).toBe(false);
	});

	it("rejects plain non-color text", () => {
		expect(isValidColor("not a color")).toBe(false);
		expect(isValidColor("")).toBe(false);
		expect(isValidColor("123")).toBe(false);
	});
});

describe("findColorsInText", () => {
	it("finds a hex color with correct offsets", () => {
		const res = findColorsInText("the color is #ff0000 here");
		expect(res).toHaveLength(1);
		expect(res[0].from).toBe("the color is ".length);
		expect(res[0].to).toBe("the color is ".length + "#ff0000".length);
		expect(res[0].color).toBe("#ff0000");
	});

	it("finds multiple colors in one string", () => {
		const res = findColorsInText("#fff and rgb(0, 0, 255) done");
		expect(res).toHaveLength(2);
		expect(res[0].color).toBe("#fff");
		expect(res[1].color).toBe("rgb(0, 0, 255)");
	});

	it("respects a start offset", () => {
		const res = findColorsInText("#ff0000", 100);
		expect(res[0].from).toBe(100);
		expect(res[0].to).toBe(100 + "#ff0000".length);
	});

	it("does not match hex fragments of longer tokens", () => {
		// 6 hex digits followed by more hex should not match as 6, and 8-digit
		// should take precedence
		expect(findColorsInText("#ff0000ff")).toHaveLength(1);
	});

	it("finds hex inside a fenced code block body", () => {
		const res = findColorsInText("```\n#ff0000\n```");
		expect(res).toHaveLength(1);
		expect(res[0].color).toBe("#ff0000");
	});

	it("finds rgb and hsl together", () => {
		const res = findColorsInText("rgb(10, 20, 30) hsl(200, 50%, 50%)");
		expect(res.map((m) => m.color)).toEqual([
			"rgb(10, 20, 30)",
			"hsl(200, 50%, 50%)",
		]);
	});

	it("returns empty when no colors present", () => {
		expect(findColorsInText("no colors in here")).toEqual([]);
	});
});

describe("hasGoodContrast", () => {
	// black text on white background has huge contrast
	it("returns true for a color with good contrast against a given bg", () => {
		expect(hasGoodContrast("#000000", false, [255, 255, 255])).toBe(true);
	});

	// white text on white background has contrast 1:1
	it("returns false for a color with poor contrast against a given bg", () => {
		expect(hasGoodContrast("#ffffff", false, [255, 255, 255])).toBe(false);
	});

	it("returns false for an invalid color", () => {
		expect(hasGoodContrast("nope", false, [255, 255, 255])).toBe(false);
	});

	it("ignores contrast and returns true when ignoreContrast is set", () => {
		expect(hasGoodContrast("#ffffff", true, [255, 255, 255])).toBe(true);
		expect(hasGoodContrast("#ffffff", true)).toBe(true);
	});

	it("returns true for invalid color when ignoring contrast", () => {
		expect(hasGoodContrast("nope", true)).toBe(true);
	});
});
