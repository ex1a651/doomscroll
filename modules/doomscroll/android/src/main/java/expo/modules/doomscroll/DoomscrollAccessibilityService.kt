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

    @Volatile var startupError: String? = null

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
    // Guard every step: this runs in the app's own process, so an uncaught
    // throw here would crash the whole app the instant the toggle is switched on.
    instance = this
    installCrashRecorder()
    try {
      counter.settleMs = Prefs.settleMs(this).toLong()
    } catch (t: Throwable) {
      startupError = "settle: ${t.message}"
    }
    try {
      imePackages = loadImePackages()
    } catch (t: Throwable) {
      imePackages = emptySet()
      startupError = "ime: ${t.message}"
    }
    try {
      registerScreenOff()
    } catch (t: Throwable) {
      startupError = "screenOff: ${t.message}"
    }
    try {
      Prefs.markConnected(this)
    } catch (_: Throwable) {
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    val now = System.currentTimeMillis()

    try {
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
    } catch (t: Throwable) {
      startupError = "event: ${t.message}"
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

  /** Records any uncaught crash in this process to prefs so the app can show it on next open. */
  private fun installCrashRecorder() {
    val ctx = applicationContext
    val prev = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, e ->
      try {
        val sw = java.io.StringWriter()
        e.printStackTrace(java.io.PrintWriter(sw))
        Prefs.setCrash(ctx, sw.toString().take(1500))
      } catch (_: Throwable) {
      }
      prev?.uncaughtException(thread, e)
    }
  }

  private fun registerScreenOff() {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_SCREEN_OFF) counter.onScreenOff(System.currentTimeMillis())
      }
    }
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    // SCREEN_OFF is a system-only broadcast, so the receiver is not exported.
    if (Build.VERSION.SDK_INT >= 33) {
      registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(receiver, filter)
    }
    screenReceiver = receiver
  }

  private fun loadImePackages(): Set<String> {
    // Public API — the Settings.Secure "enabled_input_methods" key is not readable
    // for apps targeting Android 14+ (SDK 34+).
    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? android.view.inputmethod.InputMethodManager
      ?: return emptySet()
    return imm.enabledInputMethodList.mapNotNull { it.packageName?.takeIf { p -> p.isNotBlank() } }.toSet()
  }
}
