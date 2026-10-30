/**
 * Keeps a provider key out of every error an adapter raises. A provider's error text can repeat the key it received,
 * whole or masked, and that text travels on to the dialog, the conversation history and Live's log.
 */
export class KeyGuard {
  /** A masked key in a provider's answer: a run of three or more asterisks inside one word, such as sk-ab****wxyz. */
  private static readonly MASKED = /\S*\*{3,}\S*/g;
  /** A credential written into the error text by a header or a field name. */
  private static readonly LABELLED = /\b(Bearer|x-api-key|api[_-]?key|authorization|access[_-]?token)\b(\s*[:=]\s*|\s+)((?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+))/gi;
  private static readonly HIDDEN = "[key hidden]";

  constructor(private readonly key: string) {}

  /** The text with this key, any masked key and any labelled credential replaced by a placeholder. */
  scrub(text: string): string {
    const plain = this.key ? text.split(this.key).join(KeyGuard.HIDDEN) : text;
    return plain.replace(KeyGuard.MASKED, KeyGuard.HIDDEN).replace(KeyGuard.LABELLED, `$1$2${KeyGuard.HIDDEN}`);
  }

  /** The error itself, its message and stack scrubbed in place, so its class, name and status stay as the caller expects. */
  clean(error: unknown): unknown {
    if (error instanceof Error) {
      KeyGuard.rewrite(error, "message", this.scrub(error.message));
      if (error.stack) KeyGuard.rewrite(error, "stack", this.scrub(error.stack));
      return error;
    }
    return typeof error === "string" ? this.scrub(error) : error;
  }

  /** The adapter with every method's failure cleaned, for calls that return at once or later. */
  protect<T extends object>(adapter: T): T {
    return new Proxy(adapter, {
      get: (target, property, receiver) => {
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === "function" ? this.guarded(value, target) : value;
      },
    });
  }

  private guarded(method: Function, target: object): (...args: unknown[]) => unknown {
    return (...args: unknown[]) => {
      try {
        const result: unknown = method.apply(target, args);
        return result instanceof Promise ? result.catch((error: unknown) => { throw this.clean(error); }) : result;
      } catch (error) {
        throw this.clean(error);
      }
    };
  }

  private static rewrite(error: Error, field: "message" | "stack", text: string): void {
    Object.defineProperty(error, field, { value: text, writable: true, configurable: true, enumerable: false });
  }
}
