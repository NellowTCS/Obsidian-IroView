// Shared test setup for IroView

interface WindowWithActive {
	activeDocument?: Document;
	activeWindow?: Window;
}

const currentWindow = window as WindowWithActive;

// Obsidian patches the window with `activeDocument`/`activeWindow` pointing at
// the focused DOM.
if (!currentWindow.activeDocument) {
	currentWindow.activeDocument = document;
}
if (!currentWindow.activeWindow) {
	currentWindow.activeWindow = window;
}

interface PrototypeWithCssProps {
	setCssProps?: (props: Record<string, string>) => void;
}

// Obsidian's setCssProps DOM helper, which the editor
// extension and reading view use to set CSS custom properties.
const proto = HTMLElement.prototype as PrototypeWithCssProps;
if (!proto.setCssProps) {
	proto.setCssProps = function (
		this: HTMLElement,
		props: Record<string, string>,
	) {
		for (const key of Object.keys(props)) {
			this.style.setProperty(key, props[key]);
		}
	};
}
