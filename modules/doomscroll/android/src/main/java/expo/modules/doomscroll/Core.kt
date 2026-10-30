package expo.modules.doomscroll

import android.content.Context
import java.util.Calendar
import java.util.Locale

/** Tracked apps. Keys are package names, values are the app id stored in the DB. */
object Apps {
  val PACKAGES: Map<String, String> = mapOf(
    "com.instagram.android" to "instagram",
    "com.instagram.lite" to "instagram",
    "com.google.android.youtube" to "youtube",
    "com.facebook.katana" to "facebook",
    "com.facebook.lite" to "facebook",
  )

  fun appOf(pkg: String?): String? = if (pkg == null) null else PACKAGES[pkg]
}

/** Local-time day helpers. Day keys look like 2026-10-30. */
object Day {
  fun key(ms: Long): String {
    val c = Calendar.getInstance()
    c.timeInMillis = ms
    return String.format(
      Locale.US, "%04d-%02d-%02d",
      c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)
    )
  }

  fun hour(ms: Long): Int {
    val c = Calendar.getInstance()
    c.timeInMillis = ms
    return c.get(Calendar.HOUR_OF_DAY)
  }

  fun startOfDay(ms: Long): Long {
    val c = Calendar.getInstance()
    c.timeInMillis = ms
    c.set(Calendar.HOUR_OF_DAY, 0)
    c.set(Calendar.MINUTE, 0)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    return c.timeInMillis
  }

  /** Adds whole calendar days (DST-safe). */
  fun addDays(dayStartMs: Long, days: Int): Long {
    val c = Calendar.getInstance()
    c.timeInMillis = dayStartMs
    c.add(Calendar.DAY_OF_MONTH, days)
    return c.timeInMillis
  }
}

object Prefs {
  private const val NAME = "doomscroll"
  const val DEFAULT_SETTLE_MS = 400

  private fun sp(ctx: Context) = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun settleMs(ctx: Context): Int = sp(ctx).getInt("settle_ms", DEFAULT_SETTLE_MS)
  fun setSettleMs(ctx: Context, ms: Int) = sp(ctx).edit().putInt("settle_ms", ms).apply()

  fun lastConnected(ctx: Context): Long = sp(ctx).getLong("last_connected", 0L)
  fun markConnected(ctx: Context) = sp(ctx).edit().putLong("last_connected", System.currentTimeMillis()).apply()

  fun lastSwipeAt(ctx: Context): Long = sp(ctx).getLong("last_swipe", 0L)
  fun markSwipe(ctx: Context, ms: Long) = sp(ctx).edit().putLong("last_swipe", ms).apply()

  fun crash(ctx: Context): String = sp(ctx).getString("crash", "") ?: ""
  fun setCrash(ctx: Context, msg: String) = sp(ctx).edit().putString("crash", msg).commit()
  fun clearCrash(ctx: Context) = sp(ctx).edit().remove("crash").apply()
}

