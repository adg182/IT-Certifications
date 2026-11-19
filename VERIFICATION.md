# Local verification

Local verification covers the CLF-C02 v2 bank and the SY0-701 starter bank.

The full automated suite passed on the expanded bank in **Chromium (installed Google Chrome)** and **WebKit 27.2 (Playwright)**. After the final wording edits, the production engine validated, stored, and scored the entire 475-question bank. The browser rerun stopped before loading the app because the Playwright driver disconnected. Both used isolated browser storage. WebKit is the Safari engine; these are desktop engine tests with a 390-pixel mobile viewport, not tests on a physical iPhone.

| Area | Verified behavior | Chromium | WebKit |
| --- | --- | --- | --- |
| Banks | Both exams load; 475 AWS questions and 20 Security+ questions; 25 distinct AWS prompts per task statement; multi-answer items present | Pass | Pass |
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

The question counts are shown below.

| Exam | Questions per domain, in domain order |
| --- | --- |
| AWS CLF-C02 | 100 / 100 / 200 / 75 |
| CompTIA SY0-701 | 3 / 4 / 4 / 5 / 4 |

Both banks cover every domain. AWS v2 covers all 19 official task statements, and the Security+ starter bank covers selected objectives. The questions are original practice material and the app samples them without exam weighting.

## Device verification

On a physical iPhone, open the [live site](https://adg182.github.io/IT-Certifications/) in Safari, add it to the Home Screen, and launch it online once. Airplane-mode use, Home Screen presentation, and VoiceOver still require checks on physical hardware.
