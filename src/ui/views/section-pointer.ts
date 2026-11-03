/** Pointer drags on the section list: moving a section by its grip, and linking one section to another by its handle. */

/** Where a pointer drag ends, as an index into the list's cards. */
type DropTarget = number | null;

class PointerDrag {
  /** Follows a drag until the pointer comes up; `move` sees each position, `end` runs once at release. */
  static follow(move: (event: PointerEvent) => void, end: () => void): void {
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      end();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }
}

/** Moves a section: a line shows where it lands among the other cards, and the move happens on release. */
export class SectionMover {
  constructor(
    private readonly list: HTMLElement,
    private readonly indicator: HTMLElement,
  ) {}

  start(from: number, onMove: (from: number, to: number) => void): void {
    const cards = this.cards();
    const dragged = cards[from];
    dragged?.classList.add("section--dragged");
    let target: DropTarget = null;
    PointerDrag.follow(
      (event) => {
        target = this.slot(cards, event.clientY);
        this.show(cards, target);
      },
      () => {
        dragged?.classList.remove("section--dragged");
        this.indicator.hidden = true;
        if (target === null) return;
        const to = target > from ? target - 1 : target;
        if (to !== from) onMove(from, to);
      },
    );
  }

  private cards(): HTMLElement[] {
    return Array.from(this.list.querySelectorAll<HTMLElement>(".section"));
  }

  /** The gap the pointer is nearest: before the first card whose middle lies below it. */
  private slot(cards: readonly HTMLElement[], y: number): number {
    const index = cards.findIndex((card) => {
      const box = card.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    return index === -1 ? cards.length : index;
  }

  private show(cards: readonly HTMLElement[], slot: number): void {
    const listTop = this.list.getBoundingClientRect().top - this.list.scrollTop;
    const card = cards[slot];
    const last = cards[cards.length - 1];
    const y = card ? card.getBoundingClientRect().top : last ? last.getBoundingClientRect().bottom : listTop;
    this.indicator.hidden = false;
    this.indicator.style.top = `${y - listTop}px`;
  }
}

/** Links a section to another: a cable follows the pointer from the handle, and the card under it lights up as the target. */
export class SectionLinker {
  constructor(
    private readonly list: HTMLElement,
    private readonly cable: SVGSVGElement,
  ) {}

  /** `accepts` says whether a card can take the link; `onLink` runs with the card it was dropped on. */
  start(from: number, handle: HTMLElement, accepts: (to: number) => boolean, onLink: (from: number, to: number) => void): void {
    const origin = this.point(handle);
    let target: DropTarget = null;
    PointerDrag.follow(
      (event) => {
        const box = this.list.getBoundingClientRect();
        this.draw(origin, { x: event.clientX - box.left, y: event.clientY - box.top + this.list.scrollTop });
        target = this.cardAt(event.clientX, event.clientY, accepts);
        this.light(target);
      },
      () => {
        this.cable.replaceChildren();
        this.light(null);
        if (target !== null) onLink(from, target);
      },
    );
  }

  private point(element: HTMLElement): { x: number; y: number } {
    const box = this.list.getBoundingClientRect();
    const handle = element.getBoundingClientRect();
    return { x: handle.left + handle.width / 2 - box.left, y: handle.top + handle.height / 2 - box.top + this.list.scrollTop };
  }

  private cardAt(x: number, y: number, accepts: (to: number) => boolean): DropTarget {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>(".section");
    if (!card || !this.list.contains(card)) return null;
    const index = Number(card.dataset.index);
    return Number.isInteger(index) && accepts(index) ? index : null;
  }

  private light(target: DropTarget): void {
    for (const card of this.list.querySelectorAll<HTMLElement>(".section")) {
      card.classList.toggle("section--target", Number(card.dataset.index) === target);
    }
  }

  /** A patch cable from the handle, curving out to the left and into the pointer. */
  private draw(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const reach = Math.max(36, Math.abs(to.y - from.y) * 0.22);
    const svg = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svg, "path");
    path.setAttribute("d", `M${from.x} ${from.y} C ${from.x - reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`);
    path.setAttribute("class", "lyrics-cable__line");
    const plug = document.createElementNS(svg, "circle");
    plug.setAttribute("cx", String(from.x));
    plug.setAttribute("cy", String(from.y));
    plug.setAttribute("r", "3.5");
    plug.setAttribute("class", "lyrics-cable__plug");
    const tip = document.createElementNS(svg, "circle");
    tip.setAttribute("cx", String(to.x));
    tip.setAttribute("cy", String(to.y));
    tip.setAttribute("r", "5");
    tip.setAttribute("class", "lyrics-cable__tip");
    this.cable.replaceChildren(path, plug, tip);
  }
}
