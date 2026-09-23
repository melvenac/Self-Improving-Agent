# Loop 15 slice three: rulings 5. Candidate B's repair half, and one coupling to remember

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-23 · **Model:** Opus 5.5 ·
**Effort:** high (from the transcript's per-entry field).
**Amends:** D-033's candidate B, which it does not replace. Sent to the developer before this file
was written.

---

**R23. Candidate B's REPAIR HALF is fixing G-042. Aaron's ruling ("yes").** B's capability half
stays `T-155`, the shadow merge gate, with `E_t`'s schema change (rulings-2 R10). Every loop repairs
one thing and adds one capability (`planner.md`), and G-042 is the repair this slice has paid for
most:
- Loop 16 had nine sightings.
- V-076 compared runs at the same SHA: red under contention, green when idle.
- Candidate A's full suite went red once (another project's seat busy) and green twice.
- Candidate A itself adds roughly 153s of spawning at full parallelism.

Both surviving explanations are **load**: external, or the suite's own. **D-034's pause-on-request
treats the symptom, and it stops scaling as more projects share this machine.** A suite has to pass
or fail on the code, not on what else is running.

**The shape is the developer's to choose, and the acceptance is not:** the full suite stays green
under a **deliberately generated, reproducible** CPU and disk load that turns the current code red,
**shown red first** at A's accepted SHA, with the generator and its parameters recorded. The
candidates the developer weighs include async spawns in the harness tests, a worker-pool or isolation
setting, and a per-file concurrency limit for the spawn-heavy files. The evidence to start from is
the developer's per-file event-loop table (candidate A handoff §6). **It is not closed by running
quietly:** a green run under no load says nothing about G-042, and QA's criteria must say so.

**A coupling to remember, raised by Aaron's question about running A2A-Hub alongside SIA:** A2A-Hub
now runs on SIA, so its sessions use the **same main-tree build** of SIA's hooks and MCP server. A
main-tree update and rebuild (T-172) therefore changes A2A-Hub's sessions mid-flight as well as
SIA's. **Until T-172 makes the serving build visible, the seat doing the update tells the A2A-Hub
seat before rebuilding**, the same way SIA's seats are told. The two repositories share no code or
record, so there is no correctness conflict. The coupling is the build, the knowledge database, and
machine load.
