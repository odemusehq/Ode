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

/** A readable message for anything thrown. */
export function describeError(error: unknown): string {
  return reasonOf(error) || "Live reported an error without details";
}

function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}
