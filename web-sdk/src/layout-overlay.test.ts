import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReveRegionEventDetail, SelectionMode } from "./layout-overlay.js";
import "./layout-overlay.js";
import type { V2Layout } from "./types.js";

const layout: V2Layout = {
	prompt: "a park scene",
	regions: [
		{ label: "tree", prompt: "an oak tree", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
		{ label: "bird", prompt: "a small bird", bbox: { x0: 0.5, y0: 0.5, x1: 0.75, y1: 0.75 } },
	],
};

function mountOverlay(): HTMLElementTagNameMap["reve-layout-overlay"] {
	const overlay = document.createElement("reve-layout-overlay");
	overlay.src = "https://example.test/image.png";
	overlay.layout = layout;
	document.body.appendChild(overlay);
	return overlay;
}

function regionBox(overlay: HTMLElement, label: string): HTMLDivElement {
	const box = overlay.querySelector<HTMLDivElement>(`.reve-region[data-label="${label}"]`);
	if (box === null) {
		throw new Error(`no region box for label "${label}"`);
	}
	return box;
}

function recordEvents(overlay: HTMLElement, names: string[]): { name: string; detail: ReveRegionEventDetail }[] {
	const events: { name: string; detail: ReveRegionEventDetail }[] = [];
	for (const name of names) {
		overlay.addEventListener(name, (event: Event): void => {
			events.push({ name, detail: (event as CustomEvent<ReveRegionEventDetail>).detail });
		});
	}
	return events;
}

afterEach((): void => {
	document.body.replaceChildren();
});

describe("<reve-layout-overlay>", () => {
	it("renders the image and one positioned box per region", () => {
		const overlay = mountOverlay();

		const img = overlay.querySelector("img");
		expect(img?.src).toBe("https://example.test/image.png");
		expect(img?.alt).toBe("a park scene");

		const bird = regionBox(overlay, "bird");
		expect(overlay.querySelectorAll(".reve-region")).toHaveLength(2);
		expect(bird.style.left).toBe("50%");
		expect(bird.style.top).toBe("50%");
		expect(bird.style.width).toBe("25%");
		expect(bird.style.height).toBe("25%");
	});

	it("stacks smaller regions above larger ones", () => {
		const overlay = mountOverlay();

		const treeZ = Number(regionBox(overlay, "tree").style.zIndex);
		const birdZ = Number(regionBox(overlay, "bird").style.zIndex);
		expect(birdZ).toBeGreaterThan(treeZ);
	});

	it("colors frames from the color map with a fallback to default-color", () => {
		const overlay = mountOverlay();
		overlay.defaultColor = "rgb(1, 2, 3)";
		overlay.colorMap = { bird: "rgb(9, 8, 7)" };

		expect(regionBox(overlay, "bird").style.borderColor).toBe("rgb(9, 8, 7)");
		expect(regionBox(overlay, "tree").style.borderColor).toBe("rgb(1, 2, 3)");
	});

	it("emits hover events and goes opaque on hover", () => {
		const overlay = mountOverlay();
		overlay.idleOpacity = 0.25;
		const events = recordEvents(overlay, ["reve-region-hover-enter", "reve-region-hover-leave"]);
		const bird = regionBox(overlay, "bird");
		expect(bird.style.opacity).toBe("0.25");

		bird.dispatchEvent(new Event("pointerenter"));
		expect(bird.style.opacity).toBe("1");

		bird.dispatchEvent(new Event("pointerleave"));
		expect(bird.style.opacity).toBe("0.25");

		expect(events.map((e) => e.name)).toEqual(["reve-region-hover-enter", "reve-region-hover-leave"]);
		expect(events[0]?.detail).toMatchObject({ label: "bird", index: 1 });
	});

	it("toggles selection on click, emitting selected/unselected with the selection color", () => {
		const overlay = mountOverlay();
		overlay.selectedColor = "rgb(255, 0, 0)";
		const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);
		const tree = regionBox(overlay, "tree");

		tree.click();
		expect([...overlay.selectedLabels]).toEqual(["tree"]);
		expect(tree.style.borderColor).toBe("rgb(255, 0, 0)");
		expect(tree.style.opacity).toBe("1");

		tree.click();
		expect([...overlay.selectedLabels]).toEqual([]);

		expect(events.map((e) => e.name)).toEqual(["reve-region-selected", "reve-region-unselected"]);
		expect(events[1]?.detail).toMatchObject({ label: "tree", index: 0 });
	});

	it("clearSelection unselects every selected region", () => {
		const overlay = mountOverlay();
		const events = recordEvents(overlay, ["reve-region-unselected"]);
		overlay.select("tree");
		overlay.select("bird");

		overlay.clearSelection();

		expect([...overlay.selectedLabels]).toEqual([]);
		expect(events.map((e) => e.detail.label)).toEqual(["tree", "bird"]);
	});

	it("ignores select/unselect for unknown or redundant labels", () => {
		const overlay = mountOverlay();
		const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);

		overlay.select("no-such-label");
		overlay.unselect("tree");
		overlay.select("tree");
		overlay.select("tree");

		expect([...overlay.selectedLabels]).toEqual(["tree"]);
		expect(events.map((e) => e.name)).toEqual(["reve-region-selected"]);
	});

	it("renders a text label span at the top-left of each region box", () => {
		const overlay = mountOverlay();

		const treeLabel = overlay.querySelector<HTMLSpanElement>(".reve-region[data-label='tree'] .reve-region-label");
		const birdLabel = overlay.querySelector<HTMLSpanElement>(".reve-region[data-label='bird'] .reve-region-label");
		expect(treeLabel?.textContent).toBe("tree");
		expect(birdLabel?.textContent).toBe("bird");
		expect(treeLabel?.style.display).not.toBe("none");
	});

	it("showLabels defaults to true and hides all labels when set to false", () => {
		const overlay = mountOverlay();
		expect(overlay.showLabels).toBe(true);

		overlay.showLabels = false;
		const labels = overlay.querySelectorAll<HTMLSpanElement>(".reve-region-label");
		expect(labels).toHaveLength(2);
		labels.forEach((span) => expect(span.style.display).toBe("none"));

		overlay.showLabels = true;
		overlay.querySelectorAll<HTMLSpanElement>(".reve-region-label").forEach((span) => {
			expect(span.style.display).not.toBe("none");
		});
	});

	it("show-labels attribute false hides labels; removing it restores them", () => {
		const overlay = mountOverlay();

		overlay.setAttribute("show-labels", "false");
		expect(overlay.showLabels).toBe(false);
		overlay.querySelectorAll<HTMLSpanElement>(".reve-region-label").forEach((span) => {
			expect(span.style.display).toBe("none");
		});

		overlay.setAttribute("show-labels", "true");
		expect(overlay.showLabels).toBe(true);
		overlay.querySelectorAll<HTMLSpanElement>(".reve-region-label").forEach((span) => {
			expect(span.style.display).not.toBe("none");
		});
	});

	it("getRegionLabels returns all labels in layout order", () => {
		const overlay = mountOverlay();
		expect(overlay.getRegionLabels()).toEqual(["tree", "bird"]);
	});

	it("getSelectedLabels returns an array of selected labels", () => {
		const overlay = mountOverlay();
		expect(overlay.getSelectedLabels()).toEqual([]);
		overlay.select("tree");
		expect(overlay.getSelectedLabels()).toEqual(["tree"]);
		overlay.select("bird");
		expect(overlay.getSelectedLabels()).toContain("tree");
		expect(overlay.getSelectedLabels()).toContain("bird");
	});

	it("setSelected selects and unselects by label", () => {
		const overlay = mountOverlay();
		const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);

		overlay.setSelected("tree", true);
		expect(overlay.getSelectedLabels()).toEqual(["tree"]);

		overlay.setSelected("tree", false);
		expect(overlay.getSelectedLabels()).toEqual([]);

		expect(events.map((e) => e.name)).toEqual(["reve-region-selected", "reve-region-unselected"]);
	});

	it("setSelected is a no-op for unknown labels", () => {
		const overlay = mountOverlay();
		const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);
		overlay.setSelected("no-such-label", true);
		expect(overlay.getSelectedLabels()).toEqual([]);
		expect(events).toHaveLength(0);
	});

	it("accepts layout and color-map as JSON attributes", () => {
		const overlay = document.createElement("reve-layout-overlay");
		overlay.setAttribute("layout", JSON.stringify(layout));
		overlay.setAttribute("color-map", JSON.stringify({ tree: "rgb(0, 128, 0)" }));
		document.body.appendChild(overlay);

		expect(overlay.layout).toEqual(layout);
		expect(regionBox(overlay, "tree").style.borderColor).toBe("rgb(0, 128, 0)");
	});

	it("treats invalid JSON attributes as absent", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const overlay = document.createElement("reve-layout-overlay");
		overlay.setAttribute("layout", "{not json");
		document.body.appendChild(overlay);

		expect(overlay.layout).toBeNull();
		expect(overlay.querySelectorAll(".reve-region")).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("invalid JSON"));
		warnSpy.mockRestore();
	});

	it("reve-region-clicked fires on every click regardless of selectionMode", () => {
		const overlay = mountOverlay();
		const clicked = recordEvents(overlay, ["reve-region-clicked"]);
		const tree = regionBox(overlay, "tree");

		tree.click(); // unselected click
		tree.click(); // selected click (single mode selects on first click)
		expect(clicked).toHaveLength(2);
		expect(clicked[0]?.detail).toMatchObject({ label: "tree", index: 0 });
		expect(clicked[1]?.detail).toMatchObject({ label: "tree", index: 0 });
	});

	describe("selectionMode", () => {
		it("defaults to 'single'", () => {
			const overlay = mountOverlay();
			expect(overlay.selectionMode).toBe("single");
		});

		it("unknown attribute value falls back to 'single'", () => {
			const overlay = mountOverlay();
			overlay.setAttribute("selection-mode", "bogus");
			expect(overlay.selectionMode).toBe("single");
		});

		it("single mode: clicking a new region unselects the previous one", () => {
			const overlay = mountOverlay();
			const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);

			regionBox(overlay, "tree").click();
			expect(overlay.getSelectedLabels()).toEqual(["tree"]);

			regionBox(overlay, "bird").click();
			expect(overlay.getSelectedLabels()).toEqual(["bird"]);
			expect(events.map((e) => e.name)).toEqual([
				"reve-region-selected", // tree selected
				"reve-region-unselected", // tree cleared before bird
				"reve-region-selected", // bird selected
			]);
		});

		it("single mode: clicking the selected region deselects it", () => {
			const overlay = mountOverlay();
			regionBox(overlay, "tree").click();
			expect(overlay.getSelectedLabels()).toEqual(["tree"]);

			regionBox(overlay, "tree").click();
			expect(overlay.getSelectedLabels()).toEqual([]);
		});

		it("multiple mode: clicks independently toggle each region", () => {
			const overlay = mountOverlay();
			overlay.selectionMode = "multiple";

			regionBox(overlay, "tree").click();
			regionBox(overlay, "bird").click();
			expect(overlay.getSelectedLabels()).toContain("tree");
			expect(overlay.getSelectedLabels()).toContain("bird");

			regionBox(overlay, "tree").click();
			expect(overlay.getSelectedLabels()).toEqual(["bird"]);
		});

		it("none mode: clicks do not change selection", () => {
			const overlay = mountOverlay();
			overlay.selectionMode = "none";
			const events = recordEvents(overlay, ["reve-region-selected", "reve-region-unselected"]);

			regionBox(overlay, "tree").click();
			expect(overlay.getSelectedLabels()).toEqual([]);
			expect(events).toHaveLength(0);
		});

		it("none mode: programmatic select/unselect still works", () => {
			const overlay = mountOverlay();
			overlay.selectionMode = "none";

			overlay.select("tree");
			expect(overlay.getSelectedLabels()).toEqual(["tree"]);

			overlay.unselect("tree");
			expect(overlay.getSelectedLabels()).toEqual([]);
		});

		it("none mode: reve-region-clicked still fires on click", () => {
			const overlay = mountOverlay();
			overlay.selectionMode = "none";
			const clicked = recordEvents(overlay, ["reve-region-clicked"]);

			regionBox(overlay, "bird").click();
			expect(clicked).toHaveLength(1);
			expect(clicked[0]?.detail).toMatchObject({ label: "bird", index: 1 });
		});

		it.each<SelectionMode>([
			"single",
			"multiple",
			"none",
		])("selectionMode property round-trips through the attribute (%s)", (mode) => {
			const overlay = mountOverlay();
			overlay.selectionMode = mode;
			expect(overlay.getAttribute("selection-mode")).toBe(mode);
			expect(overlay.selectionMode).toBe(mode);
		});
	});

	it("clamps idle-opacity into [0, 1] and defaults when unparseable", () => {
		const overlay = mountOverlay();

		overlay.setAttribute("idle-opacity", "3");
		expect(overlay.idleOpacity).toBe(1);

		overlay.setAttribute("idle-opacity", "-1");
		expect(overlay.idleOpacity).toBe(0);

		overlay.setAttribute("idle-opacity", "bogus");
		expect(overlay.idleOpacity).toBe(0.25);
	});
});
