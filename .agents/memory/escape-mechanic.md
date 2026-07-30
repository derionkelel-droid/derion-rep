---
name: Escape mechanic
description: 50% flee success rate; failure = instant death
---

In `handlers.ts` under `combat_run`:

```ts
const escapeRoll = Math.random() < 0.5;
if (!escapeRoll) {
  // Failed escape — instant death, respawn with half HP
}
```

**Why:** User request — makes escape a meaningful risk.
