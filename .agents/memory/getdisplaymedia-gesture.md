---
name: getDisplayMedia user-gesture requirement
description: Why getDisplayMedia must be the first await in a click handler, and what breaks if it isn't.
---

# getDisplayMedia must be the first await

Browsers (Chrome, Firefox, Safari) enforce that `getDisplayMedia()` is called within the same event-loop microtask chain as the original user gesture (the click). Any `await` before the call breaks that chain.

**Broken pattern (no picker appears):**
```js
async function onClick() {
  await new Promise(r => setTimeout(r, 350)); // ← breaks gesture
  await navigator.mediaDevices.getUserMedia(...); // ← breaks gesture again
  const stream = await navigator.mediaDevices.getDisplayMedia(...); // ← silently rejected
}
```

**Fixed pattern:**
```js
async function onClick() {
  // getDisplayMedia is the VERY FIRST await — gesture chain intact
  const stream = await navigator.mediaDevices.getDisplayMedia(...);
  // Now safe to do other async work
  await navigator.mediaDevices.getUserMedia(...);
  await new Promise(r => setTimeout(r, 350));
}
```

**Why:** The browser tracks a "transient activation" flag on the browsing context. Each `await` yields the microtask queue, which the browser uses to check whether the activation is still fresh. A `setTimeout` or any other async op before `getDisplayMedia` causes the activation to expire.

**How to apply:** Whenever adding async operations before a `getDisplayMedia` call in a user-event handler, move the `getDisplayMedia` call above all other awaits.
