package expo.modules.doomscroll

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Native-owned SQLite store. Only this class writes; JS reads through the module. */
class Db private constructor(ctx: Context) : SQLiteOpenHelper(ctx, "doomscroll.db", null, 1) {

  companion object {
    @Volatile private var instance: Db? = null
    fun get(ctx: Context): Db =
      instance ?: synchronized(this) { instance ?: Db(ctx.applicationContext).also { instance = it } }

    /** Single background thread for all writes. */
    val io: ExecutorService = Executors.newSingleThreadExecutor()
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """CREATE TABLE swipes (
        day TEXT NOT NULL, app TEXT NOT NULL,
        swipes INTEGER NOT NULL DEFAULT 0, reels INTEGER NOT NULL DEFAULT 0,
        sessions INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, app))"""
    )
    db.execSQL(
      """CREATE TABLE swipes_hourly (
        day TEXT NOT NULL, hour INTEGER NOT NULL,
        swipes INTEGER NOT NULL DEFAULT 0, reels INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, hour))"""
    )
    db.execSQL(
      """CREATE TABLE usage (
        day TEXT NOT NULL, app TEXT NOT NULL,
        opens INTEGER NOT NULL DEFAULT 0, fg_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, app))"""
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

  fun addSwipe(day: String, hour: Int, app: String, reels: Int, newSession: Boolean) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.execSQL("INSERT OR IGNORE INTO swipes (day, app) VALUES (?, ?)", arrayOf<Any>(day, app))
      db.execSQL(
        "UPDATE swipes SET swipes = swipes + 1, reels = reels + ?, sessions = sessions + ? WHERE day = ? AND app = ?",
        arrayOf<Any>(reels, if (newSession) 1 else 0, day, app)
      )
      db.execSQL("INSERT OR IGNORE INTO swipes_hourly (day, hour) VALUES (?, ?)", arrayOf<Any>(day, hour))
      db.execSQL(
        "UPDATE swipes_hourly SET swipes = swipes + 1, reels = reels + ? WHERE day = ? AND hour = ?",
        arrayOf<Any>(reels, day, hour)
      )
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  /**
   * Store computed usage. For [today] values are replaced; for past days we keep the
   * larger value, because Android only keeps raw usage events for a few days and a
   * later recompute could see less history.
   */
  fun saveUsage(rows: Map<Pair<String, String>, Pair<Int, Long>>, today: String) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      for ((key, value) in rows) {
        val (day, app) = key
        val (opens, fgMs) = value
        db.execSQL("INSERT OR IGNORE INTO usage (day, app) VALUES (?, ?)", arrayOf<Any>(day, app))
        if (day == today) {
          db.execSQL(
            "UPDATE usage SET opens = ?, fg_ms = ? WHERE day = ? AND app = ?",
            arrayOf<Any>(opens, fgMs, day, app)
          )
        } else {
          db.execSQL(
            "UPDATE usage SET opens = MAX(opens, ?), fg_ms = MAX(fg_ms, ?) WHERE day = ? AND app = ?",
            arrayOf<Any>(opens, fgMs, day, app)
          )
        }
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  fun daily(from: String, to: String): List<Map<String, Any>> {
    val out = ArrayList<Map<String, Any>>()
    readableDatabase.rawQuery(
      """SELECT k.day, k.app,
           COALESCE(s.swipes, 0), COALESCE(s.reels, 0), COALESCE(s.sessions, 0),
           COALESCE(u.opens, 0), COALESCE(u.fg_ms, 0)
         FROM (SELECT day, app FROM swipes WHERE day BETWEEN ?1 AND ?2
               UNION SELECT day, app FROM usage WHERE day BETWEEN ?1 AND ?2) k
         LEFT JOIN swipes s ON s.day = k.day AND s.app = k.app
         LEFT JOIN usage u ON u.day = k.day AND u.app = k.app
         ORDER BY k.day""",
      arrayOf(from, to)
    ).use { c ->
      while (c.moveToNext()) {
        out.add(
          mapOf(
            "day" to c.getString(0),
            "app" to c.getString(1),
            "swipes" to c.getInt(2),
            "reels" to c.getInt(3),
            "sessions" to c.getInt(4),
            "opens" to c.getInt(5),
            "fgMs" to c.getLong(6).toDouble(),
          )
        )
      }
    }
    return out
  }

  fun hourly(from: String, to: String): List<Map<String, Any>> {
    val out = ArrayList<Map<String, Any>>()
    readableDatabase.rawQuery(
      "SELECT day, hour, swipes, reels FROM swipes_hourly WHERE day BETWEEN ? AND ? ORDER BY day, hour",
      arrayOf(from, to)
    ).use { c ->
      while (c.moveToNext()) {
        out.add(
          mapOf(
            "day" to c.getString(0),
            "hour" to c.getInt(1),
            "swipes" to c.getInt(2),
            "reels" to c.getInt(3),
          )
        )
      }
    }
    return out
  }
}
