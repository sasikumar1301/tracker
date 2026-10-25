DailyBudget — project brief
Mobile app (Android first, iOS later) for salaried people. It shows how much they can spend today. Local-only: no server, no login, no analytics, no network calls.

Stack
Expo (latest stable SDK), React Native, TypeScript (strict), Expo Router, expo-sqlite with Drizzle ORM and drizzle-kit migrations, Vitest for pure-logic tests. Add other packages only when a phase says so.

Conventions
Money: integer paise everywhere. Convert only at the UI edge. Display with Indian digit grouping (₹1,00,000). The allowance is rounded down to a whole rupee.
Dates: local calendar date strings, YYYY-MM-DD. No timestamps in business logic.
Never store derived values (allowance, money left, unitemized amount). Calculate them from saved rows.
All budget math lives in src/lib/budget.ts as pure functions with no database or UI imports. Every rule below has a unit test.
Folders: app/ (screens), src/db/ (schema, queries, migrations), src/lib/ (pure logic), src/components/, src/import/ (phase 2).
Small files, no dead code, no TODO placeholders in finished features.
Cycle and money rules
Cycle start day is 1 to 28 (default 1). A cycle runs from the start day to the day before the next start day. The budgets table has one row per cycle with explicit cycle_start and cycle_end.
Per cycle the user enters salary, fixed expenses, savings target and an everyday budget (suggested = salary − fixed expenses − savings target, editable). Salary and fixed expenses are NOT transactions.
Itemized spending for a day = expenses in categories with counts_toward_budget = true. Refunds are separate rows of type refund.
Spent that day = max(itemized spending, day_total if any) − that day’s refunds.
Budget left at start of today = everyday budget − spent for every earlier day in the cycle.
Days left = days from today to cycle_end, counting today.
Allowance = floor(max(0, budget left at start of today) / days left), in whole rupees. It is fixed for the whole day.
Left today = allowance − spent today. If negative, show 'Over by ₹X'.
Cycle budget left = everyday budget − spent on all days up to and including today. If negative, show 'Overspent by ₹X' and an allowance of ₹0.
Unitemized = max(0, day_total − itemized). It is a computed line in the day list, never stored.
At cycle end nothing carries over: unspent and overspent amounts both reset. The summary keeps the numbers.
New cycle: copy the previous budget and ask the user to confirm or edit it.
Future-dated entries count only from their date. A day with no entries and no day_total counts as ₹0.
Changing the start day applies from the next cycle only. If the first setup happens mid-cycle, create the first budgets row with cycle_start = today and cycle_end = the natural cycle end.
Data model (amounts in paise)
settings(currency_symbol, cycle_start_day, reminder_enabled, reminder_time, alert_threshold, app_lock_enabled)
budgets(cycle_start, cycle_end, salary, fixed_expenses, spending_budget, savings_target)
categories(name, counts_toward_budget, is_default)
transactions(date, amount, type: expense|refund, category_id, description, note, source: manual|image, fingerprint, created_at)
day_totals(date unique, amount)
savings_entries(date, amount, note)
merchant_rules(keyword, category_id)
Default categories: Food, Groceries, Transport, Shopping, Bills, Health, Entertainment, Other (all count toward the budget) and Fixed (does not count).

Non-goals
PDF import, cloud or server text reading, SMS reading, bank APIs, multiple accounts or currencies, transfers, credit classification, server push, login or sync, chart libraries, third-party crash or analytics SDKs.

Status log
(Each phase appends: what was built, deviations, open questions.)

2026-10-24 — Phase 1: Scaffold
- Built: Expo SDK 58 app with Expo Router, React Native, strict TypeScript, SQLite/Drizzle, Vitest, and the requested npm scripts.
- Deviations: Added Expo’s required Router peers plus expo-system-ui for automatic light/dark appearance and Babel packages required to bundle Drizzle SQL migrations.
- Open questions: None.

2026-10-24 — Phase 2: Database
- Built: All seven tables, Drizzle schema and generated migration, runtime migration application, typed queries, and one-time default-category seeding.
- Deviations: None.
- Open questions: None.

2026-10-24 — Phase 3: Budget engine
- Built: Pure getCycle, spentOnDay, and getDashboard functions with integer-paise math and tests for every listed rule.
- Deviations: None.
- Open questions: None.

2026-10-24 — Phase 4: Screens
- Built: First-run setup, dashboard, add/edit bottom sheet, grouped and filtered transactions, editable day totals, deletion confirmation, and settings with light/dark styling and large controls.
- Deviations: None.
- Open questions: None.

2026-10-24 — Phase 5: New-cycle flow
- Built: Finished-cycle result, copied editable budget, skipped-cycle handling, and creation of only the cycle containing today without overlapping the prior cycle.
- Deviations: None.
- Open questions: None.

2026-10-24 — Phase 6: Development seed
- Built: npm run seed creates a standalone development SQLite database with a current demo cycle, 15 days of entries, one day total, and one refund.
- Deviations: The seeded database is written to .dev/dailybudget-demo.db because a host-side npm process cannot write into Expo Go’s device sandbox.
- Open questions: None.

2026-10-24 — Phase 7: Verification
- Built: Verified 18 unit tests, strict type checking, the seed command, dependency inventory, source audit, and an Android production bundle.
- Deviations: Physical-device Expo Go behavior remains a manual verification item.
- Open questions: None.

2026-10-24 — Screenshot import (requested phase 2)
- Built: Up-to-10-image picking, sequential on-device OCR with progress and cache cleanup, pure transaction parsing, merchant categorization and learned rules, occurrence-aware deduplication, an editable grouped review flow, atomic saves, a development-only raw OCR screen, three text fixtures, and import tests. All 39 unit tests, strict type checking, Expo configuration resolution, and an Android Hermes bundle pass. Android development-build configuration and exact build/install commands are in DEVELOPMENT_BUILD.md; Expo Go is no longer supported.
- OCR choice: `expo-text-extractor` 2.0.0. It is actively maintained, explicitly supports Expo SDK 52 and newer (including this SDK 58 project), and fits Expo managed development builds. `@react-native-ml-kit/text-recognition` can expose bounding frames, but its current repository still calls out New Architecture compatibility as untested. `expo-text-extractor` returns ordered text lines without positions, so the parser uses the required consecutive-line fallback; `src/import/ocr.ts` keeps optional position fields for a future compatible provider.
- Deviations: No line positions are available from the chosen OCR library. No schema migration was required because `transactions.description`, `transactions.source`, `transactions.fingerprint`, and `merchant_rules` were already created in the initial schema.
- Known limits: Overlapping screenshots can repeat rows and must be unticked during review. Non-Latin scripts are not read.
- Open questions: None.

2026-10-24 — Daily habits and release preparation (requested phase 3)
- Built: Local daily reminders with Android channel/permission handling and Add-sheet routing; pure one-time spending-crossing alerts; missing-day detection and dashboard actions; logged savings entry/list/delete flow; current and historical cycle summaries with plain-View category bars; adjustable alert threshold; cold-start and 60-second background app lock with device-credential fallback; three-file CSV export; two-step local data deletion; development, preview APK, and production AAB profiles; README and plain-language privacy documentation.
- Verification: All 48 unit tests pass, strict TypeScript passes, Expo native configuration resolves, the dependency audit contains only the phase-approved direct packages, and an Android Hermes bundle exports successfully.
- Deviations: No database migration was needed because reminder, threshold, app-lock, and savings storage already existed; legacy zero/null reminder settings are treated as the new 80% and 21:30 defaults until next save. CSV export opens one system share sheet per file because the supported Android sharing API shares one generated local file at a time. Native behavior and EAS cloud artifacts still require the listed real-device checks.
- Open questions: None.
