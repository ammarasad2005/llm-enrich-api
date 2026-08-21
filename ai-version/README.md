# ai-version/ — quarantined

The AI's attempt at A17, generated from a prompt I wrote from memory (see the **AI vs me**
section of the main README). Kept only for the bonus code review — **it is not the submission**;
the hand-built version in `src/` is.

Reviewed against this assignment's own checkpoints, it has the three classic failures the brief
warns about — the 10-minute default timeout left in place, raw model text returned to the caller,
and the SDK's default retries (which retry a 401) left on — plus no repair/quarantine, no cost
log, no kill switch, and no stub mode. Details and a diff are in the main README.
