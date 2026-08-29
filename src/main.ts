import { Plugin, MarkdownView } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { IroViewSettings } from "./types";
import { createIroViewExtension } from "./editor/editorExtension";
import {
	processReadingView,
	stripColorWrappers,
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

		this.registerMarkdownPostProcessor(
			(element: HTMLElement, context: MarkdownPostProcessorContext) => {
				// Always strip stale wrappers first. Obsidian can restore notes
				// from a cached rendering that still contains wrappers from a
				// previous session; stripping unconditionally keeps those from
				// persisting/duplicating even when the feature is turned off.
				if (this.settings.enableInReadingView) {
					processReadingView(element, context, this.settings);
				} else {
					stripColorWrappers(element);
				}
			},
		);

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

		// Re-run the reading-view post-processor so wrappers are recomputed with
		// the new settings. This is the single source of truth for reading-view
		// colorization; a second direct DOM pass here races the post-processor
		// and can produce duplicate swatches when toggling settings.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;

			const preview = (
				view as unknown as {
					previewMode?: { rerender: (full: boolean) => void };
				}
			).previewMode;
			if (preview) preview.rerender(true);
		});
	}
}
