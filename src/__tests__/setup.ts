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

type ObsidianDomInfo = {
	cls?: string | string[];
	text?: string;
	title?: string;
	attr?: Record<string, string | number | boolean | null>;
	parent?: Node;
	prepend?: boolean;
};

function applyDomInfo<K extends keyof HTMLElementTagNameMap>(
	el: HTMLElementTagNameMap[K],
	o?: ObsidianDomInfo | string,
	callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
	if (typeof o === "string") {
		el.textContent = o;
	} else if (o) {
		if (o.text !== undefined) el.textContent = o.text;
		if (o.cls)
			el.classList.add(...(Array.isArray(o.cls) ? o.cls : [o.cls]));
		if (o.title !== undefined) el.title = o.title;
		if (o.attr) {
			for (const k of Object.keys(o.attr)) {
				const v = o.attr[k];
				if (v !== null && v !== undefined && v !== false) {
					el.setAttribute(k, String(v));
				}
			}
		}
	}
	callback?.(el);
	return el;
}

function createElImpl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	o?: ObsidianDomInfo | string,
	callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	return applyDomInfo(el, o, callback);
}

function installInstanceHelpers(): void {
	const proto = Node.prototype as unknown as Record<string, unknown>;

	if (typeof proto.createEl !== "function") {
		Object.defineProperty(proto, "createEl", {
			value: function createEl(
				this: Node,
				tag: keyof HTMLElementTagNameMap,
				o?: ObsidianDomInfo | string,
				callback?: (el: HTMLElement) => void,
			): HTMLElement {
				const appendsTo =
					this instanceof Element || this instanceof DocumentFragment
						? this
						: undefined;
				const parentEl =
					o && typeof o === "object" ? o.parent : undefined;
				const doc = this.ownerDocument ?? document;
				const el = doc.createElement(tag);
				applyDomInfo(el, o, callback);
				const target = parentEl ?? appendsTo;
				if (this instanceof Window || this instanceof Document) {
					return el; // detached: never append to a document/root
				}
				if (target) {
					if (o && typeof o === "object" && o.prepend) {
						target.insertBefore(el, target.firstChild);
					} else {
						target.appendChild(el);
					}
				}
				return el;
			},
		});
	}

	if (typeof proto.createDiv !== "function") {
		Object.defineProperty(proto, "createDiv", {
			value: function createDiv(
				this: Node,
				o?: ObsidianDomInfo | string,
				cb?: (el: HTMLDivElement) => void,
			): HTMLDivElement {
				return this.createEl("div", o, cb);
			},
		});
	}

	if (typeof proto.createSpan !== "function") {
		Object.defineProperty(proto, "createSpan", {
			value: function createSpan(
				this: Node,
				o?: ObsidianDomInfo | string,
				cb?: (el: HTMLSpanElement) => void,
			): HTMLSpanElement {
				return this.createEl("span", o, cb);
			},
		});
	}

	if (typeof proto.createSvg !== "function") {
		Object.defineProperty(proto, "createSvg", {
			value: function createSvg(
				this: Node,
				tag: keyof SVGElementTagNameMap,
				o?: { cls?: string | string[]; attr?: Record<string, string> },
				cb?: (el: SVGElement) => void,
			): SVGElement {
				const doc = this.ownerDocument ?? document;
				const el = doc.createElementNS(
					"http://www.w3.org/2000/svg",
					tag,
				);
				if (o) {
					if (o.cls) {
						el.setAttribute(
							"class",
							Array.isArray(o.cls) ? o.cls.join(" ") : o.cls,
						);
					}
					if (o.attr) {
						for (const k of Object.keys(o.attr)) {
							el.setAttribute(k, o.attr[k]);
						}
					}
				}
				cb?.(el);
				if (
					this instanceof Element &&
					!(this instanceof Document || this instanceof Window)
				) {
					this.appendChild(el);
				}
				return el;
			},
		});
	}
}
installInstanceHelpers();

const globalObj = globalThis as Record<string, unknown>;
if (typeof globalObj.createEl !== "function") {
	globalObj.createEl = createElImpl;
	globalObj.createDiv = (
		o?: ObsidianDomInfo | string,
		cb?: (el: HTMLDivElement) => void,
	) => createElImpl("div", o, cb);
	globalObj.createSpan = (
		o?: ObsidianDomInfo | string,
		cb?: (el: HTMLSpanElement) => void,
	) => createElImpl("span", o, cb);
	globalObj.createFragment = (cb?: (el: DocumentFragment) => void) => {
		const frag = document.createDocumentFragment();
		cb?.(frag);
		return frag;
	};
	globalObj.createSvg = createElImpl;
}
