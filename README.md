# IT Certification Practice

A no-build, no-backend practice engine for iPhone Safari and desktop browsers. Includes 475 original practice questions for **AWS Certified Cloud Practitioner (CLF-C02)**, with 25 per official task statement, and 700 for **CompTIA Security+ (SY0-701)**, with 25 per official objective. Future exams use the same JSON format, with no exam-specific application code.

## Preview locally

From this repository directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000/>. Do not open `index.html` as a file: fetch, modules, and service workers need HTTP(S). To verify the GitHub project path, run the server from the repository's parent directory and open <http://localhost:8000/IT-Certifications/>. No npm install or compilation is required.

Use a current Safari, Chrome, Firefox, or Edge release. Service workers require HTTPS or localhost. To preview on an iPhone on the same network, a network-accessible HTTP server permits online testing; full offline/Home Screen testing should use the final HTTPS GitHub Pages URL. `localhost` on your phone refers to the phone itself.

## Publish on GitHub Pages

Repository: <https://github.com/adg182/IT-Certifications>

After reviewing the changes, commit and push them to `main`. Enable Pages separately using the settings below.

1. In the repository, open **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select **main** and **/(root)**, then Save.
4. Wait for the Pages deployment to finish.
5. Expected URL: <https://adg182.github.io/IT-Certifications/>

All app, icon, content, manifest, and worker URLs are relative to the project directory. `.nojekyll` serves the static files directly. There are no required Actions workflows, API keys, or server components.

**Public Pages makes the questions and answer keys readable.** JavaScript can hide explanations during a timed attempt, but cannot keep publicly downloaded keys secret. This is an independent study aid, not a secure examination system. Never put credentials, private material, or personal study history in the repository.

## Add to Home Screen on iPhone

1. Open the published HTTPS URL in Safari while connected to the internet.
2. Wait for the banks to load and the update status to finish.
3. Tap **Share → Add to Home Screen** (you may need to scroll), confirm the name, and tap **Add**. If Safari offers **Open as Web App**, leave it enabled.
4. Open the new Home Screen app online once, then test it in airplane mode.

The manifest defines a standalone app, relative start/scope, and PNG icons; an Apple touch icon is also included. Safari and an installed Home Screen app may have separate device storage. Browser storage can be evicted by the OS; clearing website data removes attempts and downloaded banks. No data syncs between devices or browsers. Private browsing may restrict persistence.

## How to practice

- Select an exam card. **Practice mode** supports all domains or one domain, a question count, immediate feedback after **Check answer**, and revisiting questions. Checked practice answers are locked to preserve learning-session scores.
- **Timed exam** supports a question count, 1–300 minutes, skipping, flagging, and a question navigator. Answers remain editable until final submission. Explanations appear only after submission. Incomplete multi-answer selections receive no credit.
- The timer stores an absolute deadline. Closing the browser does not pause it. Browsers cannot execute JavaScript while closed; on reopening, an expired attempt is immediately finalized from its saved answers and its results are shown. The app also checks on visibility changes and before answer mutations.
- Each question has equal credit. A multi-answer question is correct only when the selected IDs exactly match the full key; there is no partial credit. Unanswered questions score zero. Results show percentage, domain breakdown, and missed/unanswered review, with an option to review all questions.
- One active attempt per exam is allowed. You can leave a session and practice another exam. Attempt history is grouped by exam and retains full results and explanations. History is saved only in this browser's local storage, never sent to GitHub.
- Questions are shuffled without replacement. Both banks cover every domain. The AWS bank covers all 19 task statements, and the Security+ bank covers all 28 objectives. Sessions use an unweighted sample and do not reproduce official exam length, scaled scoring, or performance-based tasks. Percentages are practice scores, not official pass/fail predictions.

## Content format

`content/catalog.json` contains `schemaVersion: 1` and an `exams` array. Each exam has a stable `id`, display `name`, `provider`, `code`, immutable `version`, local `bank` path, and positive `defaultMinutes`.

```json
{
  "id": "example-cert",
  "name": "Example Certification",
  "provider": "Example Provider",
  "code": "EX-100",
  "version": "ex-100-v1",
  "bank": "content/example-cert/ex-100-v1.json",
  "defaultMinutes": 30
}
```

The bank has `schemaVersion`, `examId` (matching catalog ID), `version` (matching catalog version), `domains`, and `questions`. Optional description, sources, and domain weights document authoring; weights do not affect selection/scoring.

```json
{
  "schemaVersion": 1,
  "examId": "example-cert",
  "version": "ex-100-v1",
  "domains": [{"id": "1", "name": "Fundamentals", "weight": 100}],
  "questions": [{
    "id": "ex-100-001",
    "domain": "1",
    "objective": "1.1",
    "type": "single",
    "prompt": "Which control verifies a user's identity?",
    "choices": [
      {"id": "a", "text": "Authentication", "explanation": "Authentication verifies the claimed identity."},
      {"id": "b", "text": "Authorization", "explanation": "Authorization determines what an authenticated identity may access."}
    ],
    "correctAnswerIds": ["a"]
  }]
}
```

Use `type: "multiple"` and two or more `correctAnswerIds` for multi-answer items. The UI derives the required selection count from the key. Every choice needs an explanation. Question IDs and choice IDs must remain stable across revisions; do not recycle an ID for an unrelated question. IDs start with a letter or digit and contain letters, digits, hyphens, or underscores; reserved object property names are rejected. Exam IDs use lowercase letters, digits, and hyphens. Domain IDs are strings, not numbers. Bank paths must match `content/[lowercase letters, digits, slashes, hyphens].json`, without a leading slash or traversal segments.

### Update a question bank

1. Copy `content/aws-cloud-practitioner/clf-c02-v2.json` to `clf-c02-v3.json` in the same folder.
2. Change its `version` to `clf-c02-v3`, edit the questions, and preserve IDs for the same questions/choices.
3. Update the AWS catalog entry's `version` and `bank` path to the new version.
4. Validate and test, then commit the catalog and new bank together. Keep previous versioned files available.
5. After publishing, reopening or foregrounding the app checks for updates. New sessions use the new bank; active and historical sessions keep their complete original snapshots.

The app downloads the catalog and all listed banks with `cache: no-store`. It validates schema versions, identity/version matching, domain references, unique IDs, types, answer keys, and per-choice explanations. It also rejects changes to an existing cached version without a version bump. Only after the **entire set** passes does one atomic local-storage write replace the last valid content set. A failed download, invalid bank, or storage quota error leaves the last valid copy usable. On a first visit with invalid content and no previous copy, the app shows a retry state. A valid removal from the catalog hides that exam from new sessions; its saved history remains accessible.

### Add an exam

1. Create `content/example-cert/ex-100-v1.json` using the bank format above. Author original or properly licensed questions.
2. Add the example catalog entry to `exams`.
3. Run verification. Publish the new bank and catalog together. The exam card, domain picker, scoring, and history appear automatically.

### App-shell changes

Bank releases do not need service worker changes. When changing HTML, JS, CSS, icons, or the manifest, **bump `SHELL` in `sw.js`** and update `FILES` if files are added. The new worker fetches and caches the full shell before activation. Open pages are not reloaded automatically. Refresh while online to load the new shell once it is ready. Bank snapshots are separate from the shell cache and survive cache cleanup. All required fonts and assets are local; no third-party requests are needed by the app.

## Verification

See [VERIFICATION.md](./VERIFICATION.md) for the recorded local test results and remaining physical-device checks.

The optional browser tests use Python and Playwright, separate from the dependency-free app:

```sh
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium webkit
# Start a server from the parent directory on port 8000, then:
.venv/bin/python tests/verify.py --url http://localhost:8000/IT-Certifications/
```

Tests exercise the production modules and UI, with isolated browser storage and mocked network releases. They do not modify question banks or send data to GitHub.

## Content references

The questions were independently authored against these outlines:

- [AWS CLF-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/): four domains; cloud concepts, security/compliance, cloud technology/services, billing/pricing/support.
- [CompTIA Security+](https://www.comptia.org/en-us/certifications/security/): SY0-701 objectives; general security concepts, threats/vulnerabilities/mitigations, security architecture, security operations, and security program management/oversight.

Certification versions and objectives change. Confirm provider guidance when scheduling an exam. AWS and CompTIA trademarks belong to their respective owners; this project is not affiliated with either provider.


## AWS service flashcards

Open **AWS flashcards** in the main navigation. Search by service or category, reveal the service definition and example, or turn on **Guess the service** to practice in reverse. Mark learned cards to focus on the remaining deck. Learned status is stored in the browser, and the deck works offline after the app finishes caching.

The deck covers AWS services and selected tools and features from the [AWS Cloud Services catalog](https://aws.amazon.com/products/) and [AWS General Reference](https://docs.aws.amazon.com/general/latest/gr/aws-service-information.html). It omits fully shut-down products and flags reviewed [maintenance-stage products](https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html). It is a maintained snapshot, not a live inventory of every API, regional variant, or Marketplace listing.
