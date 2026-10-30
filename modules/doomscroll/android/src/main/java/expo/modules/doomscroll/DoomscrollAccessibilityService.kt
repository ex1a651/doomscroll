package expo.modules.doomscroll

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent

/**
 * Receives only scroll + window-change events (see res/xml/doomscroll_accessibility.xml).
 * Never reads screen text or window content.
 */
class DoomscrollAccessibilityService : AccessibilityService() {

  companion object {
    @Volatile var instance: DoomscrollAccessibilityService? = null
      private set

    private val log = ArrayDeque<Map<String, Any>>()
    private const val LOG_SIZE = 80

    fun debugLog(): List<Map<String, Any>> = synchronized(log) { log.toList().asReversed() }
    fun clearLog() = synchronized(log) { log.clear() }
    private fun addLog(entry: Map<String, Any>) = synchronized(log) {
      log.addLast(entry)
      while (log.size > LOG_SIZE) log.removeFirst()
    }

    private val IGNORED_WINDOW_PACKAGES = setOf("com.android.systemui")
  }

  internal val counter = SwipeCounter()
  private var imePackages: Set<String> = emptySet()
  private var screenReceiver: BroadcastReceiver? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    counter.settleMs = Prefs.settleMs(this).toLong()
    imePackages = loadImePackages()
    registerScreenOff()
    Prefs.markConnected(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    val now = System.currentTimeMillis()

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        // Ignore overlays that don't mean "left the app": notification shade, keyboard, ourselves.
        if (pkg == packageName || pkg in IGNORED_WINDOW_PACKAGES || pkg in imePackages) return
        counter.onForeground(Apps.appOf(pkg), now)
        val ctx = applicationContext
        Db.io.execute {
          try {
            UsageSync.syncIfStale(ctx, 30 * 60 * 1000L)
          } catch (_: Throwable) {
          }
        }
      }

      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        val app = Apps.appOf(pkg) ?: return
        var dy = -1
        if (Build.VERSION.SDK_INT >= 28) {
          val dx = event.scrollDeltaX
          dy = event.scrollDeltaY
          // Skip clearly horizontal scrolls (story trays, carousels).
          if (dy == 0 && dx != 0 && dx != -1) {
            addLog(mapOf("t" to now.toDouble(), "app" to app, "dy" to dy, "counted" to false, "note" to "horizontal"))
            return
          }
        }
        val swipe = counter.onScroll(app, now)
        addLog(
          mapOf(
            "t" to now.toDouble(),
            "app" to app,
            "dy" to dy,
            "counted" to (swipe != null),
            "note" to when {
              swipe == null -> "same swipe"
              swipe.newSession -> "first swipe +2"
              else -> "+1"
            },
          )
        )
        if (swipe != null) {
          val ctx = applicationContext
          Db.io.execute {
            try {
              Db.get(ctx).addSwipe(Day.key(now), Day.hour(now), swipe.app, swipe.reels, swipe.newSession)
              Prefs.markSwipe(ctx, now)
            } catch (_: Throwable) {
            }
          }
        }
      }
    }
  }

  override fun onInterrupt() {}

  override fun onUnbind(intent: Intent?): Boolean {
    instance = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    instance = null
    screenReceiver?.let {
      try {
        unregisterReceiver(it)
      } catch (_: Throwable) {
      }
    }
    screenReceiver = null
    super.onDestroy()
  }

  private fun registerScreenOff() {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_SCREEN_OFF) counter.onScreenOff(System.currentTimeMillis())
      }
    }
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= 33) {
      registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(receiver, filter)
    }
    screenReceiver = receiver
  }

  private fun loadImePackages(): Set<String> {
    val raw = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_INPUT_METHODS) ?: return emptySet()
    return raw.split(':').mapNotNull { it.substringBefore('/').takeIf { p -> p.isNotBlank() } }.toSet()
  }
}
