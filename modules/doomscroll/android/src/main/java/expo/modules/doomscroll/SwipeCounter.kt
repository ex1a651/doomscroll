package expo.modules.doomscroll

/**
 * Pure counting logic (no Android APIs) so it is easy to reason about and test.
 *
 * - A "swipe" is a burst of scroll events; a new swipe starts when no scroll
 *   event arrived for [settleMs].
 * - A "session" starts when the user opens/returns to a tracked app after being
 *   away for at least [sessionGapMs] (another app, home screen, screen off).
 * - Reels rule: the first swipe of a session counts 2 (the reel that was already
 *   showing + the next one), every later swipe counts 1.
 */
class SwipeCounter(
  @Volatile var settleMs: Long = Prefs.DEFAULT_SETTLE_MS.toLong(),
  private val sessionGapMs: Long = 10_000L,
) {
  data class Swipe(val app: String, val reels: Int, val newSession: Boolean)

  private var sessionApp: String? = null
  private var sessionSwipes = 0
  private var inTrackedApp = false
  private var leftAt = 0L
  private var lastScrollAt = 0L

  /** Foreground window changed. [app] is null for any untracked app (launcher, other apps). */
  @Synchronized
  fun onForeground(app: String?, now: Long) {
    if (app == null) {
      leave(now)
      return
    }
    if (needsNewSession(app, now)) startSession(app)
    inTrackedApp = true
    leftAt = 0L
  }

  /** Screen turned off: counts as leaving the app. */
  @Synchronized
  fun onScreenOff(now: Long) = leave(now)

  /** A scroll event from a tracked app. Returns a Swipe when a new swipe starts, else null. */
  @Synchronized
  fun onScroll(app: String, now: Long): Swipe? {
    if (needsNewSession(app, now)) startSession(app)
    inTrackedApp = true
    leftAt = 0L

    val isNewSwipe = now - lastScrollAt >= settleMs
    lastScrollAt = now
    if (!isNewSwipe) return null

    val first = sessionSwipes == 0
    sessionSwipes++
    return Swipe(app, if (first) 2 else 1, first)
  }

  private fun leave(now: Long) {
    if (inTrackedApp) {
      inTrackedApp = false
      leftAt = now
    }
  }

  private fun needsNewSession(app: String, now: Long): Boolean {
    if (sessionApp != app) return true
    if (!inTrackedApp && leftAt > 0L && now - leftAt >= sessionGapMs) return true
    return false
  }

  private fun startSession(app: String) {
    sessionApp = app
    sessionSwipes = 0
    lastScrollAt = 0L
  }
}
