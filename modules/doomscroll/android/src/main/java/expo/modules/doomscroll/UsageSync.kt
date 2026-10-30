package expo.modules.doomscroll

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process

/**
 * Computes per-day opens and foreground time for the tracked apps from Android's
 * UsageEvents and stores them in [Db].
 *
 * An "open" = the app comes to the foreground after being away for at least
 * [OPEN_GAP_MS] (switching from another app, the home screen or recents).
 */
object UsageSync {
  const val OPEN_GAP_MS = 10_000L

  // UsageEvents.Event constants (raw values so they work on every API level).
  private const val ACTIVITY_RESUMED = 1
  private const val ACTIVITY_PAUSED = 2
  private const val SCREEN_NON_INTERACTIVE = 16
  private const val ACTIVITY_STOPPED = 23
  private const val DEVICE_SHUTDOWN = 26

  @Volatile private var lastSyncAt = 0L

  fun hasPermission(ctx: Context): Boolean {
    val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= 29) {
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      ctx.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  /** Runs a sync if the last one was more than [minIntervalMs] ago. */
  fun syncIfStale(ctx: Context, minIntervalMs: Long) {
    if (System.currentTimeMillis() - lastSyncAt < minIntervalMs) return
    sync(ctx, 7)
  }

  @Synchronized
  fun sync(ctx: Context, days: Int) {
    if (!hasPermission(ctx)) return
    val now = System.currentTimeMillis()
    val todayStart = Day.startOfDay(now)
    val rangeStart = Day.addDays(todayStart, -(days - 1).coerceAtLeast(0))
    val begin = rangeStart - 3 * 60 * 60 * 1000L // look back a bit for context

    val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(begin, now) ?: return

    val opens = HashMap<Pair<String, String>, Int>()
    val fg = HashMap<Pair<String, String>, Long>()
    val resumed = HashMap<String, MutableSet<String>>() // app -> resumed activity classes
    val fgSince = HashMap<String, Long>()
    val lastEnd = HashMap<String, Long>()
    val seen = HashSet<String>()

    fun addInterval(app: String, start: Long, end: Long) {
      var a = maxOf(start, rangeStart)
      val stop = minOf(end, now)
      while (a < stop) {
        val next = Day.addDays(Day.startOfDay(a), 1)
        val segEnd = minOf(stop, next)
        val key = Day.key(a) to app
        fg[key] = (fg[key] ?: 0L) + (segEnd - a)
        a = segEnd
      }
    }

    fun close(app: String, t: Long) {
      val s = fgSince.remove(app) ?: return
      addInterval(app, s, t)
      lastEnd[app] = t
    }

    val e = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      val t = e.timeStamp
      when (e.eventType) {
        ACTIVITY_RESUMED -> {
          val app = Apps.appOf(e.packageName) ?: continue
          seen.add(app)
          val set = resumed.getOrPut(app) { HashSet() }
          set.add(e.className ?: "")
          if (fgSince[app] == null) {
            val le = lastEnd[app]
            if ((le == null || t - le >= OPEN_GAP_MS) && t >= rangeStart) {
              val key = Day.key(t) to app
              opens[key] = (opens[key] ?: 0) + 1
            }
            fgSince[app] = t
          }
        }
        ACTIVITY_PAUSED, ACTIVITY_STOPPED -> {
          val app = Apps.appOf(e.packageName) ?: continue
          if (!seen.contains(app) && e.eventType == ACTIVITY_PAUSED) {
            // App was already in the foreground when our window began.
            seen.add(app)
            addInterval(app, begin, t)
            lastEnd[app] = t
            continue
          }
          seen.add(app)
          val set = resumed[app]
          set?.remove(e.className ?: "")
          if (set == null || set.isEmpty()) close(app, t)
        }
        SCREEN_NON_INTERACTIVE, DEVICE_SHUTDOWN -> {
          for (app in fgSince.keys.toList()) close(app, t)
          resumed.clear()
        }
      }
    }
    for (app in fgSince.keys.toList()) close(app, now)

    val rows = HashMap<Pair<String, String>, Pair<Int, Long>>()
    for (key in opens.keys + fg.keys) {
      rows[key] = (opens[key] ?: 0) to (fg[key] ?: 0L)
    }
    Db.get(ctx).saveUsage(rows, Day.key(now))
    lastSyncAt = now
  }
}
