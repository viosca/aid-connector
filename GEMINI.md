# AI Development & Operational Rules for AI Dungeon Tooling

## Latitude Platform Etiquette & Publishing Safety Policy

### 1. Never Publicly Publish Scenarios or Scripts Without `--force`
- **Strict Prohibition:** AI agents and automated scripts must **never** call `publishScenario` or trigger public publication flows unless explicitly commanded by the user and confirmed with an explicit `--force` flag or `{ force: true }`.
- **Quota & Compute Respect:** Every scenario publication triggers an asynchronous moderation pipeline on Latitude's backend (evaluating script code, prompts, and metadata via LLM and safety classifiers). Latitude enforces a strict daily limit (10 AI moderation checks per user per 24 hours). Automated publishing loops exhaust this quota rapidly and impose unnecessary compute load on Latitude's servers.
- **Catalog Cleanliness:** Publishing updates community listings and discoverability feeds. Experimental test scripts, dev snapshots, and regression runs must never pollute the public scenario catalog.

### 2. Always Develop and Run Testbeds in Draft Mode (`viewPublished: false`)
- **Direct Playability:** In AI Dungeon, scenario creators do not need to publish scenarios to play them or test scripts. An unpublished scenario draft can be instantiated into an adventure at any time via `playAdventure(scenarioShortId, { viewPublished: false })`.
- **Live Draft Execution:** AI Dungeon's QuickJS execution environment directly executes the scenario creator's draft scripts (`state(viewPublished: false)`). All interactive testing, unit tests, and regression harnesses must execute against draft states.
- **Cascade Testing:** Multi-script waterfall cascades must be tested either:
  1. By attaching modular scripts to an unpublished host scenario with the tested script loaded directly as the scenario's draft script, or
  2. By creating ephemeral unpublished test scenarios that are discarded after test completion.

### 3. Graceful Handling of Moderation & Rate Limits
- If an operation encounters `getAiModerationUsageOfUser` limits or moderation staleness, stop immediately and report to the user rather than spinning in retries or attempting to reserve new moderation tickets.
