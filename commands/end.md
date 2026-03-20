# /end — Knowledge Capture (Global)

> **This is the lightweight global version.** If a project-level `/end` exists (AI-First Framework projects), it overrides this one and includes these steps already.

## What to do

1. **Review what happened this session.** Look back through the conversation for:
   - Gotchas or surprises ("oh, that doesn't work because...")
   - Patterns discovered ("the right way to do X is...")
   - Decisions made ("we went with A instead of B because...")
   - Fixes found ("the error was caused by... fixed by...")
   - Optimizations ("this is faster/better if you...")

2. **Format each lesson as an experience:**
   ```
   [EXPERIENCE] {short-title}
   PROJECT: {project-name or "general"}
   DOMAIN: {domain-tags}
   DATE: {today's date}
   TYPE: {gotcha | pattern | decision | fix | optimization}

   TRIGGER: {when this is relevant}
   ACTION: {what to do}
   CONTEXT: {what was happening}
   OUTCOME: {what happened}
   ```

3. **Dedup check:** Run `kb_recall` with each experience title. Skip if a >90% similar experience already exists. Update it if there's meaningful new detail.

4. **Store:** Use `kb_store` for each new/updated experience.

5. **Session summary:** Use `kb_store_summary` with a 2-3 sentence summary of what was accomplished.

6. **Skill check:** If you notice 3+ similar experiences accumulating around the same problem, mention it to Aaron as a candidate for skill creation. Don't create it — just flag it.

7. **Present:** Tell Aaron what was captured. Keep it brief:
   ```
   Captured:
   - [EXPERIENCE] {title} (type)
   - [EXPERIENCE] {title} (type)
   Session summary stored.
   ```

## Judgment calls

- Not every session produces experiences. A quick Q&A session might have nothing worth storing — that's fine, just say "nothing new to capture."
- Prefer fewer, high-quality experiences over many trivial ones. "I used git commit" is not an experience. "Convex actions silently fail with top-level SDK initialization" is.
- If Aaron says "don't store that" or "that's not worth remembering," respect it immediately.
