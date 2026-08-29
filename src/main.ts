import { Plugin, MarkdownView } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { IroViewSettings } from "./types";
import { createIroViewExtension } from "./editor/editorExtension";
import {
	applyColorizationToTables,
	processReadingView,
} from "./reading/readingViewProcessor";
import { IroViewSettingTab } from "./ui/settingsTab";
import type { EditorView } from "@codemirror/view";

export default class IroViewPlugin extends Plugin {
	settings: IroViewSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerEditorExtension(
			createIroViewExtension(() => this.settings),
		);

		this.registerMarkdownPostProcessor((element, context) => {
			processReadingView(element, context, () => this.settings);
		});

		this.addSettingTab(new IroViewSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<IroViewSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Nudge all open editor views to re-evaluate their decorations.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				// editor.cm is not in the public API types but is stable
				const cm = (view.editor as unknown as { cm?: EditorView }).cm;
				if (cm) cm.dispatch({});
			}
		});

		// Rebuild the reading view
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const previewMode = view.previewMode;
				if (previewMode) previewMode.rerender(true);
			}
		});

		// Tables render lazily, so `rerender` does not re-run our postprocessor
		// on their cells. Refresh tables explicitly after the render completes.
		window.requestAnimationFrame(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				const view = leaf.view;
				if (!(view instanceof MarkdownView)) return;
				const contentEl = (
					view as unknown as { contentEl?: HTMLElement }
				).contentEl;
				if (contentEl) {
					applyColorizationToTables(contentEl, this.settings);
				}
			});
		});
	}
}
