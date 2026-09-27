# QA 161 probes

SIA: `C:\qa-scratch\bf161\cand` at `d74c0e5`, build stamp `d74c0e54a936a7a31fab251c43ac68f56ec33764`. Scratch: `C:\qa-tmp\qa161-probes-JE1qlQ`. Node v24.5.0, win32.

## P-JSON-R4: seven non-record shapes, a v3 record, and an older schema

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\_
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is a JSON object with no schema_version
Next:      .agents/state.json is not a record (a JSON object with no schema_version), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `{}`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-{} — NOT A RECORD (a JSON object with no schema_version), move-residue sets aside

**OK** P-START-{} — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\_project_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_project_)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\_project_
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is a JSON object with no schema_version
Next:      .agents/state.json is not a record (a JSON object with no schema_version), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\_project_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_project_)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `{"project":{}}`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-{"project":{}} — NOT A RECORD (a JSON object with no schema_version), move-residue sets aside

**OK** P-START-{"project":{}} — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\_
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is JSON array
Next:      .agents/state.json is not a record (JSON array), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27-2/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `[]`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-[] — NOT A RECORD (JSON array), move-residue sets aside

**OK** P-START-[] — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\null   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\null)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\null
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is JSON null
Next:      .agents/state.json is not a record (JSON null), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\null   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\null)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `null`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-null — NOT A RECORD (JSON null), move-residue sets aside

**OK** P-START-null — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\42   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\42)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\42
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is JSON number
Next:      .agents/state.json is not a record (JSON number), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\42   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\42)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `42`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-42 — NOT A RECORD (JSON number), move-residue sets aside

**OK** P-START-42 — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\_text_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_text_)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\_text_
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is JSON string
Next:      .agents/state.json is not a record (JSON string), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\_text_   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\_text_)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `"text"`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-"text" — NOT A RECORD (JSON string), move-residue sets aside

**OK** P-START-"text" — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\shape\true   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\true)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\shape\true
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  NOT A RECORD — state.json is JSON boolean
Next:      .agents/state.json is not a record (JSON boolean), so this project is NOT bootstrapped. If it is left over, `bootstrap move-residue` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (`git checkout -- .agents/state.json`).
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\shape\true   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\shape\true)
bootstrap move-residue — moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-09-27/
Entries: state.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
[exit 0]
```

### shape `true`

check NOT A RECORD: true; move-residue aside: true; /start excerpt:
```


```

**OK** P-JSON-true — NOT A RECORD (JSON boolean), move-residue sets aside

**OK** P-START-true — /start on non-record reported (not scored):  

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\record\v3-record   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\record\v3-record)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\record\v3-record
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\record\v3-record   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\record\v3-record)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

**OK** P-RECORD-v3-record — v3-record stays BOOTSTRAPPED; move-residue refuses

```
$ OB bootstrap check C:\qa-tmp\qa161-probes-JE1qlQ\record\v2-record   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\record\v2-record)
bootstrap check — C:\qa-tmp\qa161-probes-JE1qlQ\record\v2-record
Template:  C:\qa-scratch\bf161\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ OB bootstrap move-residue C:\qa-tmp\qa161-probes-JE1qlQ\record\v2-record   (cwd C:\qa-tmp\qa161-probes-JE1qlQ\record\v2-record)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

**OK** P-RECORD-v2-record — v2-record stays BOOTSTRAPPED; move-residue refuses

## P-WALK-SIA: SIA's own root unchanged

**OK** P-WALK-root — resolveRepoRoot from root → SIA root

**OK** P-WALK-open-brain — resolveRepoRoot from open-brain → SIA root

**OK** P-WALK-open-brain/src — resolveRepoRoot from open-brain/src → SIA root

**OK** P-WALK-docs — resolveRepoRoot from docs → SIA root

## P-WALK-ZERO: zero-byte stray does not win (R-BF-18)

**OK** P-WALK-ZERO — zero-byte stray is not a root; walk reaches real project

## P-GREP-R21: no OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK in src/

**OK** P-GREP-R21 — git grep finds nothing


## Summary

0 failed of 22

