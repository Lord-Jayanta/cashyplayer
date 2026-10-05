/**
 * Error taxonomy, borrowed from a Piped/Invidious resolver I reviewed.
 *
 * The distinction that matters: a *definitive* negative (this track is gone,
 * this source has no audio) must not be retried down a fallback list, whereas a
 * transport blip should be. Collapsing both into `catch {}` — which this app
 * did originally — means either retrying a known-dead source forever, or
 * giving up on a source that would have answered a second later.
 */
export type ErrorKind = "network" | "empty" | "blocked";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export function toSourceError(error: unknown): SourceError {
  if (error instanceof SourceError) return error;
  const message = error instanceof Error ? error.message : String(error);
  // A 4xx from an upstream is a statement about the request, not a wobble.
  const kind: ErrorKind = /\b(40[0-9]|404|410)\b/.test(message) ? "empty" : "network";
  return new SourceError(message, kind);
}

/** Keeps whichever failure tells us the most. */
export function preferSourceError(
  a: SourceError | null,
  b: SourceError
): SourceError {
  if (!a) return b;
  // Definitive beats inconclusive, regardless of order.
  if (a.kind === "empty" && b.kind !== "empty") return a;
  return b;
}