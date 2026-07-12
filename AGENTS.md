iLoveTimers Agent Guidance

This file is durable repo guidance for future Codex and agent passes. Keep it current with the implementation. Do not paste one-off phase prompts here.

1. Project identity

iLoveTimers is a simple, minimal online timer website.

The product exists to give users clean, accurate, clutter-free timing tools that are ready to use immediately.

The site should prioritize practical utility over content, marketing, decoration, or generic SaaS-style presentation.

The core promise is: large readable timers, simple controls, accurate timing, fullscreen support, and no unnecessary interruptions.

Users should be able to open a timer, clock, stopwatch, converter, or related time tool and understand how to use it immediately.

The site supports many timing use cases: countdowns, stopwatches, Pomodoro sessions, clocks, time zones, cooking, workouts, studying, meetings, classrooms, exams, presentations, speedrunning, speedcubing, rhythm tools, and specialty displays.

Do not make the site feel like a blog, article hub, SaaS landing page, or ad farm.

Do not add features or claims that are not implemented.

Do not overclaim precision, official status, medical benefits, productivity outcomes, financial accuracy, or real-time data freshness.

iLoveTimers should remain useful for broad users while naturally prioritizing high-value western use cases where relevant, such as US, Canada, UK, and Australia classrooms, work, meetings, timesheets, business days, military time, study, productivity, and everyday timing.

2. Source-of-truth process

The shared design foundation is the source of truth for route structure, controls, settings, display frames, content bands, and theme behavior.

Inspect the actual implementation before making changes. Do not guess class names, route structure, localStorage keys, timer behavior, metadata behavior, or layout behavior.

Start with these files when checking the current system:

app/clients/components/ui/foundation.tsx

app/clients/components/ui/README.md

app/clients/design/tokens.ts

app/app.css

app/root.tsx

app/clients/hooks/useThemeMode.ts

app/clients/hooks/useFullscreen.ts

app/clients/hooks/useHotkeys.ts

app/clients/hooks/usePersistentState.ts

app/clients/hooks/useFitDisplayText.ts

app/clients/components/navigation/Footer.tsx

app/clients/components/navigation/RelatedSites.tsx

Approved migrated tool pages are better references than the current homepage if the homepage is still under review.

Do not treat a newly generated page as approved just because the build passes.

Visual QA must use rendered browser screenshots when the task is visual.

If a shared component change affects multiple pages, inspect the affected pages before reporting success.

If another page differs from the shared system, move that page toward the shared system. Do not fork a new visual system.

3. Git and worktree rules

Do not commit automatically.

Do not push automatically.

Related fixes may accumulate across multiple safe Codex passes.

Keep the worktree uncommitted while changes belong to the same major workstream.

Validate after each meaningful batch.

Commit only when the full major set is coherent, reviewed, and stable.

Push only after that milestone commit passes final validation.

Use smaller commits only when isolation is genuinely useful, such as a risky architecture change, rollback point, or unrelated workstream.

If a commit seems warranted, explain why and ask before committing.

Do not hide unrelated worktree changes.

Before editing, inspect the current diff and avoid overwriting user changes.

Report whether the worktree had pre-existing changes when the pass began.

4. Non-negotiable visual rules

These rules are intentional and should not be worked around.

No cards.

No nested cards.

No bordered layout boxes.

No outlines around layout sections.

No gradients.

No heavy shadows.

No fake panels.

No card-like hover states.

No bordered list rows.

No divider-heavy layouts.

No decorative boxed sections.

No generic SaaS-style landing page components.

No raw sitemap dumps.

No sky-blue styling.

No random color palettes.

No route-local design systems.

Use these instead:

spacing

typography

alignment

section rhythm

broad subtle background bands

restrained color contrast

clear hierarchy

shared primitives

semantic tokens

Buttons, inputs, and focus states may still need affordance for accessibility. The no-border/no-outline rule is aimed at page layout, route-link groups, cards, panels, and decorative containers. AdPlaceholder is the only layout-related exception: it may use a very subtle token-backed border or outline solely to distinguish reserved ad space from normal content. Do not remove accessible focus-visible states.

5. Color and theme profile

Use the existing palette only.

Light theme:

white

black

slate shades

amber accents

Dark theme:

near-black and deep slate backgrounds

off-white/slate foregrounds

restrained amber accents

Do not introduce blue, purple, green, rose, pink, cyan, teal, violet, or emerald as decorative UI colors.

Functional status colors may remain when they communicate behavior:

warning

urgent

invalid

success

complete

active phase

reaction-test state

metronome accent/downbeat state

Keep functional colors local and purposeful.

Do not use functional colors as general decoration.

Prefer semantic CSS tokens and shared helper classes over hard-coded Tailwind color utilities in route files.

The dark compatibility layer may exist temporarily, but it is not an excuse for careless route-level styling.

When touching ordinary route surfaces, migrate them toward shared primitives or token-backed helper classes.

6. Dark mode rules

Light mode is the default.

Dark mode is user-selected only.

There is no system theme mode.

Do not use prefers-color-scheme for default theme behavior.

Do not reintroduce a light/dark/system dropdown.

Theme mode only supports:

light

dark

Theme choice persists in localStorage using the current theme key:

ilt-theme-mode

Missing, invalid, or inaccessible localStorage must default to light.

The navbar theme control is a simple icon toggle.

The toggle must be accessible, keyboard usable, and visually minimal.

Do not implement dark mode page-by-page with scattered dark: classes.

Dark mode should rely on:

CSS tokens

shared primitives

shared helper classes

root theme setup

Do not break timer, clock, fullscreen, audio, copy, export, or localStorage behavior when working on theme code.

After theme work, verify:

missing storage defaults to light

invalid storage defaults to light

stored dark persists

stored light persists

no system mode UI exists

no prefers-color-scheme behavior exists

no hydration errors exist

7. Utility-first page structure

Tool pages must be utility-first.

Required order:

Main timer, clock, stopwatch, converter result, or active tool display.

Essential controls.

Essential settings.

Short title and description below or near the utility area, depending on the current shared pattern.

Supporting SEO/content below the utility experience.

Rules:

The tool display must be the first major visual element.

The main display should be large, readable, and visually dominant.

Do not place long explanations above the tool.

Do not place marketing text above the tool.

Do not place SEO text above the tool.

Do not place shortcut banners above the tool display.

Do not place breadcrumbs in the utility area if they make the page feel content-first.

Do not repeat the page title multiple times.

Each page should have one visible H1.

Each tool page should have one short description.

Do not repeat the same title in:

ToolHero

ToolFrame

DisplayStage

SEO section

breadcrumbs

Functional labels may remain when they describe active state:

Work

Break

Ready

Running

Round 2

Lap 3

Current split

Local time

Selected city

Fullscreen bar titles may remain because they identify the active fullscreen tool.

8. Homepage rules

The homepage must be a clean navigation and explanation page for the full site.

It should communicate:

simple online timers

clean and accurate timing tools

large readable displays

fullscreen support

no unnecessary clutter

no account required

useful routes for focus, work, cooking, workouts, clocks, and daily timing

The homepage must not look like:

a generic SaaS landing page

a raw sitemap

an ad farm

a card grid

a bordered directory

a page of disconnected text floating in empty space

Homepage layout rules:

No cards.

No bordered panels.

No outlined sections.

No boxed ad placeholders.

No fake feature cards.

No card-like link rows.

No count badges if they look like outlined pills.

No divider-heavy category sections.

Use spacing, typography, alignment, density, and broad section rhythm.

Hero should be compact, intentional, and readable.

H1 should be strong but not cartoonishly oversized.

Avoid awkward line wrapping.

Common-start links should be integrated naturally, not placed in a detached card.

Popular timers should be a polished shortcut directory, not a raw sitemap.

Browse by task should be compact and scannable, not a second sitemap dump.

Homepage route links must visibly read as links through text treatment, underline affordance, hover states, focus states, and spacing. Do not remove so much styling that navigation sections become sterile raw text.

Use text-link affordance for homepage navigation sections instead of card, row, or button affordance.

FAQ should be plain, readable, and not card-based.

The /free-online-timers route must preserve the archived four-timer homepage experience unless the user explicitly asks to change it.

9. Ad and AdSense placeholder rules

Do not add real ad code unless explicitly asked.

Before adding real AdSense code, verify the current official Google AdSense placement policies.

Ad placeholders are allowed only where requested. Current intent:

homepage-only placeholders

no real scripts

no third-party ad code

no sticky ads

no intrusive ads

no ads inside active timer tool pages unless explicitly requested later

AdSense-conscious placement rules:

Ads must not be placed where accidental clicks are likely.

Do not place ads tightly beside:

navigation links

dropdowns

buttons

timer controls

play/start controls

dense route-link lists

interactive tools

Ads must not look like navigation, timer links, recommendations, resource links, buttons, downloads, or feature content.

Ads must not be under misleading headings like:

Helpful links

Resources

Recommended

Start here

Use only the label:

Advertisements

Do not use:

Click here

Support us

Sponsors

Check this out

Recommended

Partner

Ad placeholder, top banner

Do not use arrows, animation, attention-grabbing labels, or visual emphasis pointing to ads.

Do not encourage ad clicks.

Do not style ad placeholders as cards, panels, feature boxes, or callouts.

Do not make ads visually louder than site content.

Ad placeholder sizing guidance:

Banner:

desktop: approximately 728x90, or restrained responsive behavior up to about 970x90

tablet: approximately 468x60

mobile: approximately 320x50 or 320x100

Square/in-content:

approximately 300x250

Vertical:

only where layout naturally supports it

never forced into cramped mobile layouts

Ad placeholder styling:

a very subtle token-backed border or outline is allowed only for AdPlaceholder

no ring

no shadow

no gradient

no rounded card container

no filled slab that dominates the page

label should be small, muted, and normal casing

reserve space without pretending to be content

work in light and dark mode

10. Shared component rules

Use shared components before creating route-local UI.

Relevant shared primitives include:

PageShell

ToolHero

DisplayStage

ToolFrame

ControlRail

SettingsPanel

SettingsDrawer

SeoBand

Button

ButtonLink

IconButton

Toggle

PresetChip

Field

Select

StatusChip

ContentPage

ContentSection

ContentPanel

AdPlaceholder

FullscreenTopBar

FullscreenBottomBar

Use shared hooks where practical:

useFullscreen

useHotkeys

usePersistentState

useFitDisplayText

useThemeMode

Do not create route-local versions of:

Button

Card

Chip

Badge

Toggle

Select

Field

Input wrapper

fullscreen helper

text-fitting hook

SEO wrapper

content wrapper

settings wrapper

shortcut banner

action row

Route-local components are acceptable only when they encode unique product display or behavior, such as:

binary clock grids

Fibonacci clock visual logic

Morse display logic

flip-clock digits

reaction-test state display

speedrun splits

speedcubing solve history

workout phase rendering

astronomical/moon/sun calculations

debt calculation display

metronome beat visualization

combined timer-stopwatch behavior

study stopwatch session markers

clock-plus-timer combined display

Shared components must stay generic. Do not bloat shared primitives with one-off route behavior.

11. Token-backed helper classes

Prefer token-backed helper classes for repeated ordinary UI patterns.

Current helper classes include:

ilt-surface-card

ilt-surface-muted

ilt-surface-accent

ilt-inline-pill

ilt-keycap

ilt-content-label

ilt-content-strong

ilt-input-control

ilt-helper-text

Use these for ordinary surfaces, helper rows, labels, keycaps, and muted text where appropriate.

Do not use them to recreate cards everywhere.

Do not use helper classes to hide messy route architecture. If a route is repeating a full UI pattern, consolidate into shared components instead.

12. Button and interaction rules

All interactive elements must have cursor-pointer.

Buttons must have readable default, hover, active, focus-visible, and disabled states.

Disabled controls must look disabled and be non-misleading.

Use shared Button, ButtonLink, IconButton, Toggle, Field, Select, PresetChip, and StatusChip where practical.

Do not make static content look clickable.

Do not make clickable elements look like static text unless they are standard text links.

Text links should have clear hover/focus affordance.

Do not use hover glow.

Do not use hover lift.

Do not use slow hover animations.

Avoid transition-all.

Do not nest buttons.

Do not nest links.

Do not break keyboard interactions.

13. Timer and clock behavior rules

Preserve tool behavior unless the task explicitly asks to change it.

Timer accuracy:

Do not regress countdowns into interval-drift timing.

Use Date-based reconciliation where needed.

Background tab return should reconcile visible time correctly.

Completion states must still trigger correctly.

Stopwatch elapsed time must remain accurate.

Count-up timers must not accumulate drift.

Interval timers must preserve active phase and next phase behavior.

Clock routes should derive display from current time on each tick instead of accumulating drift.

Timezone routes must preserve DST-sensitive behavior.

UTC routes must not accidentally display local time as UTC.

Epoch routes must preserve seconds versus milliseconds correctly.

Conversion routes must preserve date boundaries across time zones.

Fullscreen views must remain readable and usable.

Preserve:

route paths

metadata

loaders/actions

localStorage keys

URL parameter behavior

keyboard shortcuts

fullscreen behavior

audio behavior

notification behavior

copy/share/export/print behavior

saved sessions

history lists

presets

settings

calculations

Do not rename state variables, calculation helpers, or exported route functions unless required to fix a real issue.

14. SSR and hydration rules

Do not render SSR-visible random output with Math.random(), Date.now(), or crypto.

Use deterministic initial render values.

For live clocks, seed the initial render from loader-provided timestamps where the route already uses that pattern.

Generate random values only after hydration or explicit user action.

Do not read window, document, navigator, localStorage, or sessionStorage during SSR-visible render unless guarded so server and first client render match.

Preserve storage keys.

Do not use broad suppressHydrationWarning as a shortcut.

JSON-LD should be deterministic between SSR and first client render.

Fix invalid HTML nesting instead of suppressing warnings.

After changes involving time, localStorage, theme, or browser APIs, check for hydration errors in the browser.

15. SEO and helpful-content rules

Tool pages are tools first, content second.

SEO/content belongs below the utility area.

Do not place long content above timers, clocks, stopwatches, or calculators.

Do not add filler copy.

Do not keyword-stuff.

Do not write pages primarily to target search engines.

Do not create pages only because a keyword exists.

Do not create scaled pages where only the keyword, number, city, country, or synonym changes.

Do not repeat the page title as the first SEO heading.

Use practical headings:

How this timer works

When to use this timer

Tips for using this tool

Common uses

Frequently asked questions

What this tool can and cannot do

Content should explain what the tool does, when to use it, how to get a useful result, and what limitations apply.

Keep content page-specific and useful.

Ask whether a real user would find the page genuinely helpful, not merely adequate.

Prefer original product knowledge over generic keyword content.

Add first-hand implementation notes where useful, such as browser timing behavior, device clock limitations, local time handling, timezone assumptions, audio limitations, and calculation assumptions.

Do not overclaim:

financial precision

payroll correctness

health or sleep benefits

official timing standards

real-time data freshness

atomic accuracy

productivity outcomes

If a route uses estimates, say it is an estimate.

If a route depends on browser or device behavior, disclose that where relevant.

FAQ visible content must match FAQ JSON-LD if FAQPage schema is present.

Do not create generic article layouts unless the page is actually an informational page.

About, privacy, terms, sitemap, and legal pages may use content layouts, but should still follow the visual rules.

16. Trust, E-E-A-T, and transparency architecture

Trust signals should be useful to users, not spammy.

Core principles:

Trust is more important than decorative expertise claims.

Show real ownership, maintenance, corrections, and limitations.

Do not add giant author cards on every page.

Do not add author boxes to pure utility pages where they feel like SEO clutter.

Do not fake “reviewed by” language.

Do not fake freshness with automatic dates.

Do not invent credentials, awards, employer history, school names, addresses, phone numbers, team size, or certifications.

Do not imply official status, government affiliation, medical authority, legal authority, financial authority, or scientific time-source authority.

Required trust architecture when implemented:

/about

identifies Suhas Sunder as creator and maintainer

mentions software engineer

mentions engineering graduate

mentions master’s-degree holder

explains that iLoveTimers is an independent browser-based time tools site

explains maintenance, practical utility, browser limitations, and contact paths

/author/suhas-sunder

canonical identity page for Suhas

linked from About and selected high-trust pages

concise bio, role, credentials, and site responsibilities

no unnecessary personal details

/contact

bug reports

timer accuracy issues

calculator result issues

accessibility issues

correction requests

privacy/copyright/legal questions

general feedback

/how-ilovetimers-is-made or /editorial-guidelines

how tools are created and checked

how calculator formulas are reviewed

how browser, timezone, date, and audio limitations are disclosed

how corrections are handled

how review dates are used

what the site does not claim to be

/copyright or /dmca-copyright

copyright concern process

original tools and original explanatory content

contact path

Existing trust pages:

/privacy

/terms

/cookies

/sitemap

Use compact maintainer/review snippets only where they help, especially:

/atomic-clock

/clock-with-milliseconds

/world-clock-with-milliseconds

/utc-clock

/epoch-unix-time-clock

/unix-timestamp-converter

/time-zone-converter

/time-zone-meeting-planner

/military-time-converter

/milliseconds-converter

/time-calculator

/time-duration-calculator

/date-calculator

/date-duration-calculator

/business-days-calculator

/workdays-calculator

/work-hours-calculator

/time-card-calculator

/weekly-timesheet-calculator

/billable-hours-calculator

/reaction-time-test

/breathing-timer

/sleep-timer

Do not place bulky author modules on basic preset timer pages unless explicitly requested.

17. Accuracy and limitation disclosure rules

Use visible limitation notes where they help the user understand the tool.

Add or preserve limitation notes for:

Atomic/exact clocks:

disclose whether the page uses browser/device time or an external source

do not claim official atomic precision unless actually implemented

Millisecond clocks and stopwatches:

disclose browser, device performance, system clock, and rendering limitations

UTC, Unix, and epoch tools:

disclose device/system time dependency where relevant

clearly distinguish seconds and milliseconds

Timezone tools:

disclose timezone data, selected-location, and daylight-saving assumptions where relevant

Date calculators:

disclose inclusive/exclusive counting where relevant

Business/workday calculators:

disclose weekend and holiday assumptions

Work hours, time card, weekly timesheet, and billable-hour tools:

disclose break, rounding, overtime, payroll, accounting, and legal assumptions where relevant

Alarm pages:

disclose browser audio, permissions, background tab, and device sleep limitations

Metronome/BPM pages:

disclose browser audio scheduling limitations where relevant

Reaction time pages:

disclose device, browser, input, and display latency

Breathing/sleep pages:

general timing only

no medical claims

18. Structured data and schema rules

Structured data must match visible content.

Allowed schema types when accurate:

WebSite

Organization or site/brand entity

Person

ProfilePage

SoftwareApplication

FAQPage

BreadcrumbList

Article only for article-like guide/reference pages, not pure tool interfaces

Rules:

ProfilePage and Person belong on /author/suhas-sunder when that page exists.

Person claims must be visible on the author or About page.

Organization claims must be visible and accurate.

SoftwareApplication may be used for real tool pages when the main content is the interactive tool.

FAQPage may be used only when the same FAQ is visibly rendered.

BreadcrumbList must reflect visible or valid navigational structure.

dateModified must match a visible manual date where used.

Do not add fake ratings.

Do not add fake reviews.

Do not add aggregateRating unless the site has a real visible review system.

Do not add fake pricing or availability claims.

Do not add hidden credential claims.

Do not add fake organization address or contact details.

Do not add schema that implies official, medical, legal, financial, payroll, or scientific authority.

JSON-LD must be deterministic between SSR and first client render.

19. Date discipline rules

Use dates carefully.

Prefer “Last reviewed” for tool pages.

Use “Last updated” only when that wording is accurate.

Do not automatically refresh dates.

Do not change dates for insignificant edits.

Update review dates only after meaningful content, tool behavior, examples, FAQs, assumptions, or limitation notes were reviewed.

If structured data uses dateModified, the visible date must match.

Do not show a date if it cannot be maintained honestly.

Do not add “reviewed by” unless there is a real separate reviewer.

20. Navigation, routing, and canonical rules

Preserve all public route paths.

Do not remove /free-online-timers.

/ is the main homepage.

/free-online-timers is the archived four-timer homepage experience.

Header/nav should stay clean and minimal.

Do not overload the top nav.

The More menu/directory should remain searchable and usable.

Internal links must point only to real canonical routes.

Do not link internally to redirect aliases.

If adding/removing a public route, update:

route config

HTML sitemap

XML sitemap

nav/directory search data where appropriate

related links where appropriate

metadata where appropriate

tests/audits where appropriate

Do not create typo aliases unless explicitly requested.

Do not create many indexable keyword-variant pages.

Use redirects for useful synonyms only when they improve users and avoid duplicate content.

Redirect aliases must not be listed in XML sitemap.

XML sitemap should contain canonical indexable URLs only.

Do not include noindex pages, redirects, or temporary URLs in XML sitemap.

Canonical URLs should be stable and self-referential unless there is an intentional consolidation strategy.

Approved route expansion direction for the current SEO/tool workstream:

/timer-stopwatch

real combined countdown timer and stopwatch utility

not a doorway page

/study-stopwatch

real count-up study/focus stopwatch

distinct from /study-timer, /focus-session-timer, and /pomodoro-timer

/timer-clock

real clock plus countdown timer display

useful for classrooms, meetings, exams, presentations, and workouts

Possible later route:

/us-time-zones-clock

only if implemented as a useful US timezone tool

do not create many state/city/timezone doorway pages

Use redirects or canonical handling instead of indexable duplicates for variants such as:

/stopwatch-timer

/timer-and-stopwatch

/online-timer-stopwatch

/stopwatch-countdown

/countdown-stopwatch

/focus-stopwatch

/stopwatch-for-study

/study-timer-stopwatch

/clock-timer

/online-clock-timer

/military-time-calculator

/army-time-converter

/military-time-translator

/ms-to-seconds

/milliseconds-to-seconds

/utc-time-now

/current-unix-timestamp

Do not create indexable pages like:

/2105-military-time

/1730-military-time

/1000ms-to-seconds

/60000ms-to-seconds

/ist-time-now

/india-time-now

21. Internal linking rules

Internal links should help users choose the next useful tool.

Use contextual links, not exact-match spam.

Use descriptive anchors that explain the next page naturally.

Do not add giant repeated link blocks to every page.

Do not make every page link to every other page.

Do not hide important pages so they are reachable only from the sitemap.

Important pages should be linked from relevant hubs, sibling tools, footer where appropriate, and contextual sections.

Related tools should follow user journeys, not keyword clusters alone.

Link anchors should be concise and useful.

Avoid repetitive anchors across hundreds of pages.

Important clusters:

Stopwatch cluster:

/stopwatch

/stopwatch-with-milliseconds

/timer-stopwatch

/study-stopwatch

/count-up-timer

Study/focus cluster:

/study-timer

/study-stopwatch

/focus-session-timer

/pomodoro-timer

/break-timer

Millisecond/exact-time cluster:

/clock-with-milliseconds

/world-clock-with-milliseconds

/atomic-clock

/utc-clock

/epoch-unix-time-clock

/milliseconds-converter

/millisecond-timer

Military time cluster:

/military-time-converter

/military-time-clock

/24-hour-clock

/12-hour-clock

Timezone/meeting cluster:

/time-zone-converter

/time-zone-meeting-planner

/world-clock

/utc-clock

Date calculator cluster:

/date-calculator

/date-duration-calculator

/days-until-calculator

/weeks-between-dates-calculator

/months-between-dates-calculator

/business-days-calculator

/week-number-calculator

Work/time tracking cluster:

/work-hours-calculator

/time-card-calculator

/weekly-timesheet-calculator

/billable-hours-calculator

/billable-hours-clock

Alarm/audio cluster:

/online-alarm-clock

/alarm-timer

/metronome

/bpm-tapper

HTML sitemap/category pages should group tools by user task, not just keyword:

Timers

Stopwatches

Clocks

World time and time zones

Date and time calculators

Work/time tracking

Fitness timers

Kitchen timers

Classroom, meeting, and presentation timers

Fun/experimental clocks

Trust and site information

22. Homepage and /free-online-timers

/ is the current main landing/navigation homepage.

/free-online-timers preserves the old four-timer homepage.

Do not mix the two.

Do not refactor /free-online-timers unless the user explicitly asks.

The archived route may keep some local primitives if needed to preserve behavior, but fix serious accessibility or dark-mode readability bugs if discovered.

Homepage ad placeholders must not appear on tool routes.

Homepage links must be valid.

Homepage should be visually checked at:

desktop width

tablet width

390px mobile width

light mode

dark mode

23. Accessibility rules

Each page should have one visible H1.

Heading order should be sensible.

Buttons need accessible names.

Inputs need labels.

Interactive elements must be keyboard reachable.

Focus-visible states must remain visible.

Do not remove accessible focus indicators to satisfy visual rules.

Links should be descriptive enough.

Fullscreen controls should be accessible.

Theme toggle must have accurate accessible labels:

Switch to dark mode

Switch to light mode

aria-pressed or equivalent state should remain accurate where used.

Reaction/tap-heavy pages must preserve keyboard behavior where supported.

Do not rely only on color to communicate critical state if text/status labels already exist.

No black text on dark backgrounds.

No unreadable muted text in dark mode.

24. Privacy and client-side behavior

Do not send timer names, custom notes, user-entered labels, saved sessions, typed content, worksheet-style content, or route-specific user data to analytics unless explicitly implemented with privacy review.

Do not add third-party scripts without explicit user approval.

Do not add real ad scripts without explicit user approval.

Do not encode user private content into share URLs unless the route intentionally supports it and the privacy implications are handled.

Be truthful about local browser behavior.

Preserve existing localStorage behavior and keys unless a task explicitly requires migration.

Cookie consent, if present, must not block tool usage.

Cookie consent, if present, must not cause large layout shift.

Privacy and cookie pages must match the actual scripts and storage behavior used on the site.

25. Testing and validation expectations

For code changes, run:

npm run typecheck

npm run build

node --check server.js

git diff --check

Run tests if present:

npm run test --if-present

For frontend changes, browser-check affected pages.

For shared component changes, check:

the page being edited

at least one representative timer route

at least one representative clock route

homepage if shared visual primitives are affected

dark mode and light mode

For visual changes, inspect actual rendered screenshots. Do not claim success from class changes or build success alone.

Minimum visual checks for homepage work:

/

/free-online-timers

/countdown-timer

/digital-clock

desktop

tablet

390px mobile

light mode

dark mode

Minimum checks for tool route work:

route loads

no console errors

no hydration errors

no mobile overflow at 390px

main utility display appears first and remains dominant

controls work

settings work

fullscreen works where supported

keyboard shortcuts work where supported

audio/notification behavior works where present

copy/share/export/print works where present

dark mode remains readable

light mode remains unchanged except intended fixes

For route-sweep work:

Check all configured public routes.

Verify no render crash.

Verify no mobile horizontal overflow.

Verify no missing H1.

Verify no off-homepage ad placeholders.

Verify no obvious unreadable dark-mode text.

Do not leave temporary files behind:

.codex-route-sweep.tmp.js

.playwright-cli

temporary browser scripts

generated smoke files in repo root

If a test script is useful permanently, place it in an appropriate scripts/tests location and document it.

26. Automated SEO and quality audit expectations

When adding durable scripts or checks, prefer lightweight repo-local audits that do not require internet access.

Useful audits include:

duplicate title detection

duplicate meta description detection

missing title detection

missing meta description detection

missing canonical detection

sitemap canonical validation

redirects in sitemap detection

noindex URL in sitemap detection

broken internal link detection

orphan page detection

internal links pointing to redirect aliases

thin content detection

repeated intro detection

repeated FAQ detection

visible FAQ versus FAQPage schema validation

structured data hidden-claim detection where practical

fake rating/review schema detection

visible date versus dateModified validation where practical

route metadata completeness

trust page existence

author page existence

About page links to author/contact/methodology

selected high-trust pages have visible limitation notes

book/publication-style author checks are not relevant to iLoveTimers unless such content is later added

These audits should help prevent future low-value, scaled-content, schema, and trust regressions.

27. Reporting expectations

Every Codex pass should report:

changed files

what was changed

protected files or areas not touched

behavior changes, if any

validation commands run

browser checks run

remaining risks

temporary files removed or intentionally kept

whether any pre-existing worktree changes were present

whether any recommended follow-up work remains

Do not claim success from build/typecheck alone when the task involved rendered UI.

For visual tasks, report actual browser/screenshot QA results.

For SEO/content tasks, report:

routes changed

metadata changed

canonical changes

sitemap changes

schema changes

internal links changed

pages intentionally skipped

any risk of duplicate or thin content

whether visible content matches schema

For trust/E-E-A-T tasks, report:

trust pages added or updated

author/maintainer signals added

where maintainer snippets were added and why

where they were intentionally not added and why

visible dates added or changed

limitation notes added

confirmation that no fake credentials, reviews, ratings, or hidden claims were added

For AdSense/ad placeholder tasks, report:

no real ad code added

no third-party ad scripts added

ad placement safeguards

which pages show placeholders

confirmation placeholders do not appear on tool pages unless requested

For dark mode tasks, report:

missing storage defaults to light

invalid storage defaults to light

stored dark persists

stored light persists

icon toggle works

no system mode returned

no hydration errors

28. Current strict priorities

When instructions conflict, prioritize in this order:

Preserve tool behavior and accuracy.

Preserve utility-first layout.

Follow no-card/no-border/no-outline/no-gradient visual rules.

Use shared primitives and tokens.

Keep light mode default and dark mode simple.

Keep ads AdSense-conscious and non-intrusive.

Keep SEO/content useful, honest, and below the utility.

Avoid scaled, duplicate, thin, or keyword-only pages.

Preserve trust, transparency, and visible methodology.

Keep homepage minimal but intentionally designed.

Keep routes, metadata, sitemap, schema, canonicals, redirects, and localStorage stable.

Validate in the browser, not only by build output.

Do not commit or push without explicit approval.

If a requested implementation would violate these rules, stop and choose the safer implementation that preserves the product direction.
