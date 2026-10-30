# Doomscroll

A personal Android dashboard that shows how much you scroll Instagram, YouTube and Facebook, and rewards you for scrolling less.
Sister app to [sleeping](https://github.com/ex1a651/sleeping) and [calories](https://github.com/ex1a651/calories). Dark-blue minimalist, sideload only.

## What it tracks

| Metric | Source | Notes |
|---|---|---|
| **Swipes** | AccessibilityService (`TYPE_VIEW_SCROLLED`) | Any vertical scroll burst while one of the 3 apps is in front. Bursts are merged with a tunable window (default 400 ms). |
| **Est. reels** | derived | First swipe after opening an app = 2 (the reel already showing + the next), each later swipe = +1. |
| **Opens** | UsageStatsManager events | Counted when the app comes to the foreground after ≥10 s away (other app, home, recents, screen off). |
| **Time** | UsageStatsManager events | Foreground time, split at midnight. |

All numbers stay on the phone in a native SQLite DB. The accessibility service only receives scroll + window-change events,
never reads screen content (`canRetrieveWindowContent=false`), and never performs actions.

## Dashboard

- **Today**: reels so far vs your usual pace at this time of day, time/opens/swipes, wins (streaks, lowest day, week-over-week drops, time reclaimed), split by app, yesterday vs average
- **Trends**: reels-per-day chart (7/14/30 d) colored vs average, 7-day/30-day/all-time averages, this week vs last week, best/worst day, streak, peak scrolling hour
- **Apps**: opens, time, reels, swipes, avg visit, reels per open, per app (today / 7 d / 30 d)
- **Setup**: permission checklist, OnePlus keep-alive steps, live swipe test with adjustable merge window

## Install & setup (OnePlus 13 / Android 15+)

1. Download `doomscroll-app.apk` from **Releases → Latest build**, install (allow unknown apps; Play Protect → Install anyway).
2. Setup tab → **Usage access** → allow Doomscroll.
3. Setup tab → **Turn on** swipe counting. If it's greyed out ("Restricted setting"): App info → ⋮ → *Allow restricted settings*, then enable it.
4. Battery → Unrestricted; enable Auto-launch; lock the app in Recents.
5. Use the Live test card to check one swipe = one count.

## Code layout

- `modules/doomscroll/`: local Expo module (Kotlin): `DoomscrollAccessibilityService`, `SwipeCounter` (pure logic), `UsageSync`, `Db`, JS bridge
- `src/stats.ts`: all dashboard math (averages, pace, streaks, wins)
- `src/screens/`: Today, Trends, Apps, Setup

Every push to `main` builds the APK in GitHub Actions.
