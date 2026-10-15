import type { DraftStore } from "../core/store.js";
import type { PipelineStore } from "./handle.js";

/** The pipeline receives a store that cannot mark a draft sent or call the sender. */
export function asPipelineStore(store: DraftStore): PipelineStore {
  return {
    markProcessed: (id) => store.markProcessed(id),
    unmarkProcessed: (id) => store.unmarkProcessed(id),
    findBySource: (id) => store.findBySource(id),
    create: (input) => store.create(input),
    update: (id, patch) => store.update(id, patch),
    get: (id) => store.get(id),
    withLock: (id, fn) => store.withLock(id, fn),
  };
}
