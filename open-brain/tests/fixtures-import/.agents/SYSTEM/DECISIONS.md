# Architectural Decision Records

Synthetic fixture for the importer: every heading shape the parser handles, made-up content.

## Decisions

### ADR-001: A partial date is kept in the note, not the date field

- **Date:** 2026-03
- **Context:** The fixture needs one decision whose Date line is not a full ISO date.
- **Decision:** The importer stamps the migration date and records the original in the note.

### ADR-002: A full date is kept as written

- **Date:** 2026-03-22
- **Decision:** Nothing to infer; the line is the date.

### ADR-003: A decision with no Date line at all

- **Decision:** The importer stamps the migration date and says the original is unknown.

### ADR: An unnumbered heading the importer must skip

- **Date:** 2026-04-01
- **Decision:** No id can be assigned deterministically, so this one is reported and left in the prose file.

### ADR-004: The last numbered decision, also undated

- **Decision:** Ordering in `decisions[]` follows the file, not the id.
