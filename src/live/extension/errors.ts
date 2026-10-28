/** A reference that points at nothing in the Set; the message names the reference. */
export class NotFoundError extends Error {
  constructor(what: string) {
    super(`not found: ${what}`);
    this.name = "NotFoundError";
  }
}

/** Something Live refused to do. The SDK rejects some failures without a reason, so the message says what was tried. */
export class LiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveError";
  }

  /** Waits for `work`; a failure becomes "Live could not <action>". */
  static async guard<T>(work: Promise<T>, action: string): Promise<T> {
    try {
      return await work;
    } catch (error) {
      const reason = reasonOf(error);
      throw new LiveError(reason ? `Live could not ${action}: ${reason}` : `Live could not ${action}`);
    }
  }
}

/** Something Live refused to read; the message names it, as in 'couldn't read track 3 "Bass": <reason>'. */
export class UnreadableError extends Error {
  constructor(what: string, cause: unknown) {
    super(`couldn't read ${what}: ${describeError(cause)}`, { cause });
    this.name = "UnreadableError";
  }

  /** Runs `read`; a failure names `what`, unless a read inside it already named its own object. */
  static guard<T>(what: string, read: () => T): T {
    try {
      return read();
    } catch (error) {
      throw UnreadableError.naming(what, error);
    }
  }

  /** Like guard, for a read that finishes later. */
  static async guardAsync<T>(what: string, read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      throw UnreadableError.naming(what, error);
    }
  }

  private static naming(what: string, error: unknown): UnreadableError {
    return error instanceof UnreadableError ? error : new UnreadableError(what, error);
  }
}

/** A readable message for anything thrown. */
export function describeError(error: unknown): string {
  return reasonOf(error) || "Live reported an error without details";
}

function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}
