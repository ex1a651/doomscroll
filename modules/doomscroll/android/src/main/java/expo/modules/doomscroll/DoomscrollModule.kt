package expo.modules.doomscroll

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoomscrollModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("Doomscroll")

    Function("getStatus") {
      val ctx = context
      mapOf(
        "usageAccess" to UsageSync.hasPermission(ctx),
        "accessibilityEnabled" to isAccessibilityEnabled(ctx),
        "serviceRunning" to (DoomscrollAccessibilityService.instance != null),
        "batteryUnrestricted" to isIgnoringBatteryOptimizations(ctx),
        "lastSwipeAt" to Prefs.lastSwipeAt(ctx).toDouble(),
        "lastConnectedAt" to Prefs.lastConnected(ctx).toDouble(),
      )
    }

    Function("openUsageAccessSettings") {
      open(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    Function("openAccessibilitySettings") {
      open(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    Function("openAppDetails") {
      open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    Function("requestBatteryUnrestricted") {
      val ok = open(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
      )
      if (!ok) open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    AsyncFunction("syncUsage") { days: Int ->
      UsageSync.sync(context, days)
      true
    }

    AsyncFunction("getDaily") { from: String, to: String ->
      Db.get(context).daily(from, to)
    }

    AsyncFunction("getHourly") { from: String, to: String ->
      Db.get(context).hourly(from, to)
    }

    Function("getDebugLog") {
      DoomscrollAccessibilityService.debugLog()
    }

    Function("clearDebugLog") {
      DoomscrollAccessibilityService.clearLog()
    }

    Function("getSettleMs") {
      Prefs.settleMs(context)
    }

    Function("setSettleMs") { ms: Int ->
      val v = ms.coerceIn(100, 2000)
      Prefs.setSettleMs(context, v)
      DoomscrollAccessibilityService.instance?.counter?.settleMs = v.toLong()
      v
    }
  }

  private fun open(intent: Intent): Boolean {
    return try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun isAccessibilityEnabled(ctx: Context): Boolean {
    val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
      ?: return false
    val me = ComponentName(ctx, DoomscrollAccessibilityService::class.java)
    return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
  }

  private fun isIgnoringBatteryOptimizations(ctx: Context): Boolean {
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(ctx.packageName)
  }
}
