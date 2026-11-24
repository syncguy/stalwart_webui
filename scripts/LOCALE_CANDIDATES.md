# Offline localization planning, stage 17

Run from a checkout of `ru` with the locked dependencies already installed:

```sh
NODE_OPTIONS='--import=./scripts/lib/offline-guard.mjs' node scripts/generate-locale-candidates.mjs
node scripts/check-locale-candidates.mjs
```

The first command also regenerates the stage16 inventory from the two pinned
gzip fixtures. It does not download schemas, translate through an external
service, build/package the application, or write any `src/` file. Reports go
only under `.artifacts/`. Dependencies are prepared separately with `npm ci`;
the generator never installs missing dependencies. The CI workflow installs
locked dependencies before running the network-blocked analysis.

## Outputs

| File in `.artifacts/locale-candidates/` | Purpose |
| --- | --- |
| `summary.md` | Seven categories, Settings/Management/Account and every menu screen |
| `classification.json` | Every source slot/original, exact source locations, usage contexts, actual lookup keys, mode counts and access conditions |
| `candidates.json` | Semantic review groups, ranked RU suggestions, alternatives, exact targets; `apply=false` and `reviewStatus=pending` |
| `review.md` | Full editorial queue, including groups without a known translation |
| `diff.json` | Added/removed originals and classification changes against an optional previous report |

Compare a saved report without modifying it:

```sh
node scripts/generate-locale-candidates.mjs --baseline=.artifacts/previous/classification.json
```

Without a baseline, the diff explicitly marks the initial inventory as added.
No timestamp, live server response, current timezone or host ICU result is
inserted into the deterministic outputs. Shared slots are counted once within
each scope, so section/screen totals must not be summed. A screen with zero
schema slots can be a custom page whose client strings need separate review.

`classification.json` normalizes repeated data: a row's `usages[].context`
indexes `usageContexts`, `location` indexes that row's `locations`, and `text`
indexes `displayTexts`. An omitted usage `lookupSlot` means the row's `slot`.
All conditions, renderer names and source pointers remain available.

## What the categories mean

| Category | Meaning |
| --- | --- |
| `translated` | Audited static consumers have a matching accepted translation; this is not browser acceptance |
| `missing` | Audited consumers lack a translation in at least one mode |
| `keep-original` | Explicit slot/original policy for an unchanged standard label |
| `technical` | Explicit technical example or a narrowly recognized URI, number, address, path, JSON or LDAP placeholder |
| `renderer-unwired` | A raw display path or mismatched actual lookup needs a renderer/context fix; adding a source-slot translation alone is insufficient |
| `unreachable/conditional` | No proven consumer from the menu traversal; direct routes, search or custom code may still use it |
| `needs-review` | Original/hash conflict, source drift, custom/compact renderer, conditional Intl output, or other explicit uncertainty |

Translation, renderer and reachability facts are retained separately. A
previously translated catalogue entry can be classified as renderer-unwired
for an unhandled display mode without changing its accepted text. Global
categories cover all discovered uses; section/screen/mode categories use only
their own consumers. No license, ACL or operator profile is fabricated. Gates
are recorded, including permission prefixes, Enterprise flags, variant and
nonempty-value conditions; effective access is always `unknown` in this phase.

The graph follows navigation → view aliases → actual `resolveObject`,
`resolveSchema`, `resolveList`, `resolveForm` and variant/nested field links.
Nested object/map/list recursion is finite and shared nodes are deduplicated
per screen/mode. Per-field permission filtering and actual React execution are
not simulated. Custom pages and specialized widgets are conservative review
items. Compact list summaries are not counted as complete nested forms.

`EnumWidgets` already translates explanations; the stage16 UNKNOWN-RENDERER
annotation is not used to exclude all explanations. Conversely, the permission
catalogue is only credited in the `EnumMultiSelect` path that calls it. Quota
and header-protection helpers are similarly scoped. Locale/timezone labels are
marked as conditional Intl output, not frozen as this host's translations.
The task/index fallback is evaluated through the actual pure `schemaText`.

## Candidates and context

The tool reads the accepted catalogue and existing helper translations as TM.
Suggestions are ordered by exact contextual candidate, preserved accepted
translation, matching domain/display-role/field group, accepted terminology
decision, other contextual translations, and glossary. Equal English words
alone never merge different grammatical/display roles into one group.
Multiple variants remain visible; there is no fuzzy or word-by-word approval.
An exact exception may select a proposal for its own schema hash; alternatives
remain recorded. `selected` means editor preview, never permission to apply.

The policy records the already accepted `Observability` → `Наблюдение` and
`Logs` → `Журнал`, overriding the obsolete glossary alternatives only when
their exact accepted source entries still match. The glossary itself is not
rewritten. Dangerous actions, permissions, TLS/OIDC, external resources and
units get an additional editorial flag. Protected token multisets cover
placeholders, inline code, URLs, Markdown destinations and HTML tags/attributes.
Unsafe proposals cannot be selected for preview.

Both MySQL/PostgreSQL section-3 conflicts keep separate exact targets:

| Schema | Original | Proposal |
| --- | --- | --- |
| OSS `Pryc909aTNRr_k6uwZLvZNs74YaPQv-PXQ38t2K7VlY` | `Pools` | `Пулы соединений` |
| Enterprise `fyG-0rY0Q0Zq2PwUyaVPqnGT0nyS7AYK5SCmreTDZXs` | `Read Replicas` | `Реплики для чтения` |

The binding is the tuple `(schemaHash, slot, original)`. A later reviewed
runtime adapter could store per-hash entries and retain exact original guards.
This stage **does not add that runtime adapter or populate the catalogue**.
The offline preview tests both correct bindings, wrong edition/hash, changed
original and EN fallback; the real application continues to show English for
these unaccepted entries. Array order cannot resolve a conflict.

## Maintenance and evidence limits

`data/locale-review-policy.json` contains exact keep/technical/context rules,
known schema hashes, source-adapter SHA-256 pins, and stage17 protected-input
hashes. When a renderer changes, CI fails and emits a drift diagnostic. Read
the changed code and update the corresponding graph adapter/tests before
reviewing a new pin; do not blindly regenerate hashes. New source originals,
stale exceptions and new schemas also require review. The underlying stage16
loader independently validates gzip/hash/blob/JSON inputs and fails closed
on unknown schemas. Later approved translation work must explicitly revise
the stage17 protected catalogue baseline.

The Node tests cover graph mappings, cycles, helper scope, both conflicts,
unknown/changed originals and schemas, drift, glossary/context exceptions,
protected tokens, output-path protection and catalogue immutability. CI repeats
all output files and compares SHA-256, runs earlier locale/renderer regressions,
TypeScript and ESLint. The existing ESLint configuration checks TS/TSX; the new
Node scripts are executed by their own assertions. None of these checks prove
React DOM output, interactions, live ACL/JMAP, egress, installation or rollback.
Those remain independent later tests with synthetic component data and one
reviewed application package for a completed batch.


## Stage18–19 — activated reviewed batches

Stage18 activated 54 ordinary entries, two keep-original decisions and four edition-scoped entries. The Stage17 candidate-only description above is historical; per-hash lookup is now active with exact original guards.

Stage19 adds 146 ordinary groupware translations (Account Mailbox, Calendar, AddressBook; Settings CalendarScheduling, CalendarAlarm, WebDav). The reviewed packet retains apply=false; the generator never writes the catalog. Explicit source edits activate reviewed entries. The ordered reviewedBatches list in locale-review-policy.json is protected by packet SHA-256 pins. check-reviewed-batches.mjs reconstructs preceding catalogs, verifies their byte digests, regenerates eligible scopes with the real resolver, rejects ambiguities and mismatched originals, validates actual display lookup, and checks bare protocol tokens. This verifier supports ordinary wired-missing translations only; keep-original and edition conflicts require their own policy path. No external translation service.
