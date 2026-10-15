import type { DraftStore } from "./store.js";

/**
 * Restart recovery never calls the sender.
 * A send that was in progress becomes Uncertain so a person can check Teams.
 */
export function recoverDrafts(store: DraftStore): number {
  let changed = 0;
  for (const draft of store.list()) {
    if (draft.status === "sending") {
      store.markUncertain(
        draft.id,
        "TeamsPilot restarted while a send was in progress. Check that chat in Teams. The message may or may not be there. TeamsPilot will not retry automatically.",
      );
      changed += 1;
    } else if (draft.status === "generating" || draft.status === "detected") {
      store.update(draft.id, {
        status: "failed",
        error: "TeamsPilot restarted before this reply was ready. Nothing was sent. Regenerate if you still want a suggestion.",
        currentReply: "",
        generatedReply: "",
      });
      changed += 1;
    }
  }
  return changed;
}
