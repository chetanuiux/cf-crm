## Update `src/lib/daily-phrases.ts`

### Rewrite the 18 phrases you listed
Replace entries at positions 3, 4, 6, 9, 15, 22, 32, 54, 66, 71, 76, 79, 89, 91, 92, 96, 98, 105 with fresh phrases (same tone — professional, encouraging, occasionally goofy, emojis allowed). No mentions of "pipeline" or weekday names in any replacement.

### Also rewrite phrases you missed
Scanning the current list for the same banned words, one slipped through:
- **#99** — "The pipeline rewards the prepared. 🎒"

I'll rewrite that one too with the same rules.

### Keep list length at 150
Rather than deleting the offending entries (which would shrink the cycle to 149 and shift every index), I'll **replace** each one in place so the array stays exactly 150 entries and the daily rotation logic in `getDailyPhrase()` is unaffected. No other code changes.

### Verification
After the edit I'll grep the file for `pipeline`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` to confirm zero matches remain, and confirm the array still has 150 entries.
