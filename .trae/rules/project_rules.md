# Project Rules — Trae (with MCP Playwright and Memory)

These rules define how Artemis and any other automation should behave in this project.
They are simplified to keep explanations clear for non-developers.

---

## General Goals

* Keep code clean and simple.
* Avoid unnecessary complexity or large frameworks.
* Focus on small, working steps that can be tested easily.
* Always explain in Portuguese what is being done and why.
* Use MCP tools (Playwright and Memory) to automate repetitive or testing tasks.

---

## Response Flow

1. What we will do — short and clear.
2. How it works — simple explanation.
3. Step by step — small list of actions.
4. Code ready to use — clean and minimal.
5. Automatic test (when asked) — run or create tests via MCP Playwright.
6. Final summary — what was done, how to test, and one improvement idea.

---

## Code Style

* Language follows the current project stack (Node, Python, PHP, etc.).
* Prefer readability over abstraction.
* Use modern async code and clear variable names.
* Keep file and folder names simple.
* Add short comments explaining key logic.

Example structure:

```
src/
 ├─ domain/        (rules and main entities)
 ├─ application/   (use cases, main logic)
 ├─ infra/         (database, API calls, integrations)
 ├─ interfaces/    (controllers, routes, UI)
 └─ tests/         (automated tests)
```

---

## Quality Checks

During development, Artemis or any automation should confirm that:

* Lint and type checks pass (no blocking errors).
* The project builds successfully.
* A simple smoke test runs (main feature works).
* All files stay small and focused.

---

## Testing Rules

* Tests are done mainly at the end, unless the user asks earlier.
* Use **MCP Playwright** for navigation and UI testing:

  * Run smoke test through sitemap or main routes.
  * Test main flow (login to dashboard or similar).
  * Capture screenshots and trace report.
* Report results in Portuguese, clearly stating what worked and what failed.
* If MCP Playwright is not available, show equivalent local command (example: `npx playwright test`).

---

## MCP Integration

**Playwright**

* Used to browse the system and check that all pages load without errors.
* Required environment variables:

  * `BASE_URL`
  * `PLAYWRIGHT_HEADLESS`
  * `STORAGE_STATE` (optional for logged tests)

**Memory**

* Used to store and retrieve:

  * Project decisions
  * Entity definitions
  * Discovered routes
  * Test cases or important notes
* Only save neutral information (no secrets).

---

## Deliverables

Every completed task must include:

* Clear explanation of what was done.
* Working minimal code.
* A quick smoke test result.
* Optional MCP Playwright report or screenshots.
* `.env.example` and `README.md` if new setup or variables were added.

---

## Final Checklist

* [ ] Code works and is easy to read.
* [ ] Explanation in Portuguese is clear.
* [ ] Lint, build, and smoke tests pass.
* [ ] (If requested) MCP Playwright tests executed.
* [ ] Notes stored or updated in Memory MCP.
* [ ] Readme updated with how to test.

---

These rules ensure that Artemis builds professional systems in small, understandable steps — and that everything can be verified easily at the end.
