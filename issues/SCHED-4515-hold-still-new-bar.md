---
id: SCHED-4515
title: List holds still; "N new" bar brings new incidents in
status: ready
plan: R1, R2, R4
---

Product's answer to the step-1 report: "Watched it at 00:29. The list holds still while it is on screen; a
"N new" bar brings new incidents in on click. Ack stays on the row."

- Shown rows never move or get removed by a refresh; changed incident text updates in place.
- New incidents wait; a "N new" bar (`data-testid="new-bar"`) in space kept for it above the list counts
  them. A click brings them in at the top, newest first, and hides the bar.
- Ack stays a one-click button on each row (`data-testid="ack"`).

Acceptance: with the pointer on a row's Ack while incidents arrive, the click acks that row; the bar shows
the waiting count, and a click on it puts the new incidents on top.
