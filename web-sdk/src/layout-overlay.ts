/**
 * `<reve-layout-overlay>`: renders an image with the regions of a partner API
 * v2 layout overlaid as colored frames. Lightweight web component; no shadow
 * DOM and no framework dependencies.
 *
 * Region frames are drawn in a per-label color from {@link ReveLayoutOverlay.colorMap}
 * (falling back to `default-color`). Idle frames are drawn at `idle-opacity`
 * (0 makes them fully transparent), become opaque on hover, and use
 * `selected-color` while selected.
 *
 * The `selection-mode` attribute (property {@link ReveLayoutOverlay.selectionMode})
 * controls what happens when a region is clicked:
 * - `"single"` (default): the previously selected region (if any) is unselected
 *   first, then the clicked region is selected. Clicking a selected region deselects it.
 * - `"multiple"`: each click independently toggles the region's selection.
 * - `"none"`: clicks do not change selection; the programmatic API still works.
 *
 * Events (all `CustomEvent<ReveRegionEventDetail>`, bubbling):
 * - `reve-region-hover-enter`
 * - `reve-region-hover-leave`
 * - `reve-region-clicked` — fired on every click regardless of `selectionMode`
 * - `reve-region-selected`
 * - `reve-region-unselected`
 */

import type { V2Layout, V2Region } from "./types.js";

/** Controls how region clicks change the selection state. */
export type SelectionMode = "single" | "multiple" | "none";

/** Names of the custom events emitted by {@link ReveLayoutOverlay}. */
type RegionEventName =
	| "reve-region-hover-enter"
	| "reve-region-hover-leave"
	| "reve-region-clicked"
	| "reve-region-selected"
	| "reve-region-unselected";

/** A region together with its index in `layout.regions`. */
interface RegionEntry {
	region: V2Region;
	index: number;
}

/** Detail payload for the region events emitted by {@link ReveLayoutOverlay}. */
export interface ReveRegionEventDetail {
	region: V2Region;
	/** Index of the region within `layout.regions`. */
	index: number;
	label: string;
}

const STYLE_ELEMENT_ID = "reve-layout-overlay-styles";

const COMPONENT_CSS = `
reve-layout-overlay {
	position: relative;
	display: inline-block;
	line-height: 0;
}
reve-layout-overlay > img {
	display: block;
	max-width: 100%;
}
reve-layout-overlay .reve-region {
	position: absolute;
	box-sizing: border-box;
	border: 2px solid transparent;
	cursor: pointer;
}
reve-layout-overlay .reve-region-label {
	position: absolute;
	top: 0;
	left: 0;
	line-height: normal;
	font-size: 0.7rem;
	font-family: system-ui, sans-serif;
	white-space: nowrap;
	pointer-events: none;
	color: #ffffff;
}
`;

function ensureDocumentStyles(doc: Document): void {
	if (doc.getElementById(STYLE_ELEMENT_ID) !== null) {
		return;
	}
	const style = doc.createElement("style");
	style.id = STYLE_ELEMENT_ID;
	style.textContent = COMPONENT_CSS;
	doc.head.appendChild(style);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

export class ReveLayoutOverlay extends HTMLElement {
	static readonly observedAttributes = [
		"src",
		"layout",
		"color-map",
		"default-color",
		"selected-color",
		"idle-opacity",
		"show-labels",
		"selection-mode",
	];

	private layoutValue: V2Layout | null = null;
	private colorMapValue: Record<string, string> = {};
	private readonly selected = new Set<string>();

	// -- Properties -------------------------------------------------------

	/** The layout whose regions are overlaid on the image. */
	get layout(): V2Layout | null {
		return this.layoutValue;
	}

	set layout(value: V2Layout | null) {
		this.layoutValue = value;
		this.render();
	}

	/** Maps region label to a CSS color for that region's frame. */
	get colorMap(): Record<string, string> {
		return this.colorMapValue;
	}

	set colorMap(value: Record<string, string>) {
		this.colorMapValue = value;
		this.render();
	}

	/** URL of the image to render under the overlay. */
	get src(): string {
		return this.getAttribute("src") ?? "";
	}

	set src(value: string) {
		this.setAttribute("src", value);
	}

	/** Frame color used when a label has no entry in the color map. */
	get defaultColor(): string {
		return this.getAttribute("default-color") ?? "#ffffff";
	}

	set defaultColor(value: string) {
		this.setAttribute("default-color", value);
	}

	/** Frame color used while a region is selected. */
	get selectedColor(): string {
		return this.getAttribute("selected-color") ?? "#ff4000";
	}

	set selectedColor(value: string) {
		this.setAttribute("selected-color", value);
	}

	/** Frame opacity for regions that are neither hovered nor selected; 0..1. */
	get idleOpacity(): number {
		const raw = this.getAttribute("idle-opacity");
		const parsed = raw === null ? Number.NaN : Number.parseFloat(raw);
		return Number.isFinite(parsed) ? clamp01(parsed) : 0.25;
	}

	set idleOpacity(value: number) {
		this.setAttribute("idle-opacity", String(value));
	}

	/**
	 * Whether region text labels are shown at the top-left of each region box.
	 * Defaults to `true`; set to `false` or use the `show-labels="false"` attribute to hide them.
	 */
	get showLabels(): boolean {
		return this.getAttribute("show-labels") !== "false";
	}

	set showLabels(value: boolean) {
		this.setAttribute("show-labels", String(value));
	}

	/**
	 * Controls how region clicks change the selection state.
	 * - `"single"` (default): clears any existing selection then selects the clicked region.
	 *   Clicking an already-selected region deselects it.
	 * - `"multiple"`: each click independently toggles the region's selection.
	 * - `"none"`: clicks do not change selection; the programmatic API still works.
	 * Unknown attribute values fall back to `"single"`.
	 */
	get selectionMode(): SelectionMode {
		const raw = this.getAttribute("selection-mode");
		if (raw === "multiple" || raw === "none") return raw;
		return "single";
	}

	set selectionMode(value: SelectionMode) {
		this.setAttribute("selection-mode", value);
	}

	/** Labels of the currently selected regions. */
	get selectedLabels(): ReadonlySet<string> {
		return this.selected;
	}

	// -- Selection --------------------------------------------------------

	/** Select the region with the given label; emits `reve-region-selected`. */
	select(label: string): void {
		const found = this.findRegion(label);
		if (found === null || this.selected.has(label)) {
			return;
		}
		this.selected.add(label);
		this.syncRegionStyles();
		this.emitRegionEvent("reve-region-selected", found);
	}

	/** Unselect the region with the given label; emits `reve-region-unselected`. */
	unselect(label: string): void {
		const found = this.findRegion(label);
		if (found === null || !this.selected.has(label)) {
			return;
		}
		this.selected.delete(label);
		this.syncRegionStyles();
		this.emitRegionEvent("reve-region-unselected", found);
	}

	/** Unselect all selected regions, emitting `reve-region-unselected` for each. */
	clearSelection(): void {
		for (const label of [...this.selected]) {
			this.unselect(label);
		}
	}

	/** Returns the labels of all currently selected regions as an array. */
	getSelectedLabels(): string[] {
		return [...this.selected];
	}

	/**
	 * Set the selection state of a region by label.
	 * Equivalent to calling `select` or `unselect` depending on `selected`.
	 */
	setSelected(label: string, selected: boolean): void {
		if (selected) {
			this.select(label);
		} else {
			this.unselect(label);
		}
	}

	/** Returns the labels of all regions in the current layout, in order. */
	getRegionLabels(): string[] {
		return (this.layoutValue?.regions ?? []).map((r) => r.label);
	}

	// -- Lifecycle --------------------------------------------------------

	connectedCallback(): void {
		ensureDocumentStyles(this.ownerDocument);
		this.render();
	}

	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
		if (oldValue === newValue) {
			return;
		}
		if (name === "layout") {
			this.layoutValue = newValue === null ? null : this.parseJsonAttribute<V2Layout>(name, newValue);
		} else if (name === "color-map") {
			this.colorMapValue =
				newValue === null ? {} : (this.parseJsonAttribute<Record<string, string>>(name, newValue) ?? {});
		}
		this.render();
	}

	private parseJsonAttribute<T>(name: "layout" | "color-map", value: string): T | null {
		try {
			return JSON.parse(value) as T;
		} catch {
			console.warn(`<reve-layout-overlay>: invalid JSON in "${name}" attribute`);
			return null;
		}
	}

	// -- Rendering --------------------------------------------------------

	private render(): void {
		if (!this.isConnected) {
			return;
		}
		this.replaceChildren();
		if (this.src !== "") {
			const img = this.ownerDocument.createElement("img");
			img.src = this.src;
			img.alt = this.layoutValue?.prompt ?? "";
			this.appendChild(img);
		}
		const regions = this.layoutValue?.regions ?? [];
		const zOrder = this.zIndexByArea(regions);
		regions.forEach((region, index) => {
			this.appendChild(this.createRegionBox({ region, index }, zOrder[index] ?? 0));
		});
		this.syncRegionStyles();
		this.syncLabelVisibility();
	}

	/** Larger regions get lower z-index so nested regions stay hoverable. */
	private zIndexByArea(regions: V2Region[]): number[] {
		const order = regions
			.map((region, index) => ({ index, area: this.bboxArea(region) }))
			.sort((a, b) => b.area - a.area);
		const zIndexes = new Array<number>(regions.length).fill(0);
		order.forEach((entry, rank) => {
			zIndexes[entry.index] = rank + 1;
		});
		return zIndexes;
	}

	private bboxArea(region: V2Region): number {
		const { x0, y0, x1, y1 } = region.bbox;
		return Math.abs(x1 - x0) * Math.abs(y1 - y0);
	}

	private createRegionBox({ region, index }: RegionEntry, zIndex: number): HTMLDivElement {
		const box = this.ownerDocument.createElement("div");
		box.className = "reve-region";
		box.dataset.label = region.label;
		const { x0, y0, x1, y1 } = region.bbox;
		box.style.left = `${clamp01(x0) * 100}%`;
		box.style.top = `${clamp01(y0) * 100}%`;
		box.style.width = `${clamp01(x1 - x0) * 100}%`;
		box.style.height = `${clamp01(y1 - y0) * 100}%`;
		box.style.zIndex = String(zIndex);

		const labelSpan = this.ownerDocument.createElement("span");
		labelSpan.className = "reve-region-label";
		labelSpan.textContent = region.label;
		box.appendChild(labelSpan);

		box.addEventListener("pointerenter", () => {
			box.dataset.hovered = "true";
			this.applyRegionStyle(box, region);
			this.emitRegionEvent("reve-region-hover-enter", { region, index });
		});
		box.addEventListener("pointerleave", () => {
			delete box.dataset.hovered;
			this.applyRegionStyle(box, region);
			this.emitRegionEvent("reve-region-hover-leave", { region, index });
		});
		box.addEventListener("click", () => {
			this.emitRegionEvent("reve-region-clicked", { region, index });
			const mode = this.selectionMode;
			if (mode === "none") return;
			if (this.selected.has(region.label)) {
				this.unselect(region.label);
			} else {
				if (mode === "single") this.clearSelection();
				this.select(region.label);
			}
		});
		return box;
	}

	private syncLabelVisibility(): void {
		const display = this.showLabels ? "" : "none";
		this.querySelectorAll<HTMLSpanElement>(".reve-region-label").forEach((span) => {
			span.style.display = display;
		});
	}

	private syncRegionStyles(): void {
		const regions = this.layoutValue?.regions ?? [];
		const boxes = this.querySelectorAll<HTMLDivElement>(".reve-region");
		boxes.forEach((box, index) => {
			const region = regions[index];
			if (region !== undefined) {
				this.applyRegionStyle(box, region);
			}
		});
	}

	private applyRegionStyle(box: HTMLDivElement, region: V2Region): void {
		const isSelected = this.selected.has(region.label);
		const isHovered = box.dataset.hovered === "true";
		const frameColor = isSelected ? this.selectedColor : (this.colorMapValue[region.label] ?? this.defaultColor);
		box.style.borderColor = frameColor;
		box.style.opacity = isSelected || isHovered ? "1" : String(this.idleOpacity);
	}

	private findRegion(label: string): RegionEntry | null {
		const regions = this.layoutValue?.regions ?? [];
		const index = regions.findIndex((region) => region.label === label);
		const region = regions[index];
		return region === undefined ? null : { region, index };
	}

	private emitRegionEvent(name: RegionEventName, { region, index }: RegionEntry): void {
		this.dispatchEvent(
			new CustomEvent<ReveRegionEventDetail>(name, {
				detail: { region, index, label: region.label },
				bubbles: true,
			}),
		);
	}
}

if (typeof customElements !== "undefined" && customElements.get("reve-layout-overlay") === undefined) {
	customElements.define("reve-layout-overlay", ReveLayoutOverlay);
}

declare global {
	interface HTMLElementTagNameMap {
		"reve-layout-overlay": ReveLayoutOverlay;
	}
}
