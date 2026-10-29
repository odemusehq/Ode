import { TAG_SEPARATOR } from "../../shared/live";

/** An object in Live whose name can be read and changed. */
export interface Nameable {
  name: string;
}

/** A name that may end with the tag Ode gives the objects it creates, as in "Chorus melody ·o3f2". */
export class TaggedName {
  private constructor(
    readonly name: string,
    readonly tag: string | undefined,
  ) {}

  static parse(fullName: string): TaggedName {
    const at = fullName.lastIndexOf(TAG_SEPARATOR);
    const tag = at < 0 ? "" : fullName.slice(at + TAG_SEPARATOR.length);
    return TaggedName.isTag(tag) ? new TaggedName(fullName.slice(0, at), tag) : new TaggedName(fullName, undefined);
  }

  static of(name: string, tag: string | undefined): TaggedName {
    return new TaggedName(name, tag);
  }

  /** Whether `fullName` ends with Ode's `tag`. */
  static carries(fullName: string, tag: string): boolean {
    return fullName.endsWith(`${TAG_SEPARATOR}${tag}`);
  }

  /** A tag is a single word. */
  static isTag(text: string): boolean {
    return text.length > 0 && !/\s/.test(text);
  }

  /** Gives `target` a new name and keeps its tag. */
  static rename(target: Nameable, name: string): void {
    target.name = new TaggedName(name, TaggedName.parse(target.name).tag).toString();
  }

  toString(): string {
    return this.tag === undefined ? this.name : `${this.name}${TAG_SEPARATOR}${this.tag}`;
  }
}

/** The name for an object Ode creates: the given name, or the one Live chose, followed by Ode's tag. */
export class NewName {
  constructor(
    private readonly name: string | undefined,
    private readonly tag: string | undefined,
  ) {
    if (tag !== undefined && !TaggedName.isTag(tag)) throw new RangeError(`"${tag}" is an invalid tag: a tag is a single word`);
  }

  /** Names `target`. A copy loses the tag of the object it was copied from unless it gets one of its own. */
  applyTo<T extends Nameable>(target: T): T {
    const fullName = TaggedName.of(this.name ?? TaggedName.parse(target.name).name, this.tag).toString();
    if (fullName !== target.name) target.name = fullName;
    return target;
  }
}
