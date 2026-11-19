# Local verification

Verified November 18, 2026 against the static app at `http://localhost:8000/IT-Certifications/`. No changes were pushed and GitHub Pages settings were not changed.

The full automated suite completed successfully in **Chromium (installed Google Chrome)** and **WebKit 27.2 (Playwright)**. Both used isolated browser storage. WebKit is the Safari engine; these are desktop engine tests with a 390-pixel mobile viewport, not tests on a physical iPhone.

| Area | Verified behavior | Chromium | WebKit |
| --- | --- | --- | --- |
| Banks | Both exams load; 20 questions each; all four AWS and five Security+ domains represented; multi-answer items present | Pass | Pass |
| Practice | Both exams; domain filtering; question count; immediate explanations; checked answers lock | Pass | Pass |
| Timed exam | Both exams; configured time/count; skip, flag, navigate, revisit; answers hidden until submission | Pass | Pass |
| Scoring | Single answers; complete multi-answer keys regardless of order; no credit for partial, extra, duplicate, or unanswered choices | Pass | Pass |
| Results | Percentage and domain totals; missed/unanswered review; toggle to all questions | Pass | Pass |
| Persistence | Answers, flags, position, original deadline and bank snapshot survive refresh | Pass | Pass |
| History | Separate exam sections; repeated practice/timed sessions retained; prior results reopen | Pass | Pass |
| Deadline | Foreground timeout; reopening after deadline; automatic results; no duplicate history entry | Pass | Pass |
| Updates | Valid new version installs; new attempts use it; active/history retain their original bank | Pass | Pass |
| Validation | Reject duplicate IDs, invalid keys/domain/version, missing explanations, unsafe paths, and unversioned edits; preserve last valid set | Pass | Pass |
| Offline | Real service worker shell cache and saved banks; offline reload/resume, switching exams, practice and results | Pass | Pass |
| Layout | Desktop and 390px layouts; no horizontal overflow; answer targets at least 44px high | Pass | Pass |
| Runtime | No uncaught page JavaScript exceptions during the suite | Pass | Pass |

The optional test runner is `tests/verify.py`. Its release tests mock the fetch boundary without editing production banks, then restore normal fetch for real offline reloads. This avoids WebKit's automation-routing limitation around service-worker requests. Core validation is also exercised directly using the production `core.js` module and isolated in-memory storage. Screenshots are saved under ignored `test-results/`.

The starter-bank coverage counts are:

| Exam | Questions per domain, in domain order |
| --- | --- |
| AWS CLF-C02 | 5 / 6 / 6 / 3 |
| CompTIA SY0-701 | 3 / 4 / 4 / 5 / 4 |

These cover every domain, but are not weighted replicas of the certification exams and do not cover every objective. Content was independently authored; no provider exam items were copied.

## Remaining publishing and device checks

1. Obtain approval before pushing the new app to the existing repository's `main` branch and before changing Pages settings.
2. Configure **Settings → Pages → Deploy from a branch → main → /(root)** and wait for deployment.
3. Verify the live HTTPS URL: <https://adg182.github.io/IT-Certifications/>.
4. On a real iPhone, use Safari's **Share → Add to Home Screen**, launch once online, then verify airplane-mode use, close/reopen behavior, and timer expiry in the installed app. Also confirm the icon and standalone presentation.

Physical iPhone installation, Safari storage eviction/quota behavior, VoiceOver, live GitHub CDN propagation, and deployment have not been tested. Local browser checks do not establish these outcomes. Browser storage remains device- and origin-specific; there is no backup or cross-device sync.
