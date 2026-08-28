import { App, PluginSettingTab, Setting } from "obsidian";
import type IroViewPlugin from "../main";

export class IroViewSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: IroViewPlugin,
	) {
		super(app, plugin);
	}

	// 1.13.0+: Obsidian calls this and skips display().
	// Settings bind to this.plugin.settings[key] via `control`, and side effects
	// run through setControlValue(). No 1.13+ API is invoked here so the plugin
	// stays installable on Obsidian < 1.13.0 (where this method is never called).
	getSettingDefinitions() {
		return [
			{
				name: "Show color swatch",
				desc: "Display a small colored square before color values",
				control: { type: "toggle" as const, key: "showSwatchInEditor" },
			},
			{
				name: "Colorize text",
				desc:
					"Apply the color to the text itself (e.g., #ff0000 appears in red). " +
					"Colors with low contrast against the current theme background will not be colorized.",
				control: {
					type: "toggle" as const,
					key: "colorizeTextInEditor",
				},
			},
			{
				name: "Ignore contrast",
				desc:
					"Always colorize text, even when its contrast against the " +
					"theme background is low.",
				control: { type: "toggle" as const, key: "ignoreContrast" },
			},
			{
				name: "Enable in reading view",
				desc: "Show color previews when viewing rendered Markdown",
				control: {
					type: "toggle" as const,
					key: "enableInReadingView",
				},
			},
			{
				name: "Supported color formats",
				render: (setting: Setting) => {
					setting.setHeading();
					setting.setDesc(
						"Supported formats: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb/rgba (rgb(255, 0, 0)), and hsl/hsla (hsl(120, 100%, 50%)).",
					);
				},
			},
		];
	}

	// 1.13.0+: Called by Obsidian after a declarative control writes a value.
	// Centralizes side effects so getSettingDefinitions() stays free of 1.13+ API
	// calls.
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] =
			value;
		await this.plugin.saveSettings();
	}

	// < 1.13.0: Obsidian calls this. Keep for older Obsidian versions.
	display(): void {
		this.renderLegacy();
	}

	private renderLegacy(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Configuration").setHeading();

		new Setting(containerEl)
			.setName("Show color swatch")
			.setDesc("Display a small colored square before color values")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSwatchInEditor)
					.onChange(async (value) => {
						this.plugin.settings.showSwatchInEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Colorize text")
			.setDesc(
				"Apply the color to the text itself (e.g., #ff0000 appears in red). " +
					"Colors with low contrast against the current theme background will not be colorized.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeTextInEditor)
					.onChange(async (value) => {
						this.plugin.settings.colorizeTextInEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ignore contrast")
			.setDesc(
				"Always colorize text, even when its contrast against the theme background is low.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.ignoreContrast)
					.onChange(async (value) => {
						this.plugin.settings.ignoreContrast = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable in reading view")
			.setDesc("Show color previews when viewing rendered Markdown")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInReadingView)
					.onChange(async (value) => {
						this.plugin.settings.enableInReadingView = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Supported color formats")
			.setHeading();

		new Setting(containerEl).setDesc(
			"Supported formats: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb/rgba (rgb(255, 0, 0)), and hsl/hsla (hsl(120, 100%, 50%)).",
		);
	}
}
