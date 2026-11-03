package expo.modules.cpoollive

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.SoundPool
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.widget.RemoteViews
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import expo.modules.cpoollive.CpoolDraw.Companion.colorOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

// The live ride card (guest and host) and the host's floating island, as approved in the demos
// (cpool-guest-card.html, cpool-host-island.html):
// - Card: Cpool draws it in the demo's colours, compact. Collapsed = title and text, one line each; opened = header
//   "C Cpool · Pickup · 8:31", title, text, vehicle tile or guest face, the bar with labels, Call / Share trip. Phones
//   wrap it in their own frame and list it like any notification (an app-drawn card can't go in Android's "Live" spot).
// - Host (options.island set): the island over other apps (CpoolIsland), a ride service so Cpool isn't paused in the
//   background (CpoolRideService), and a background JS task ("CpoolRide") so the app's timers keep running there.
class CpoolLiveModule : Module() {
  private val channelId = "live_card" // high importance, silent: ranks the card as high as Android allows
  private val liveChannel = "live_ride" // Android's Live Update, for phones with their own island (default importance)
  private val notificationId = CpoolRideService.NOTIFICATION_ID
  private val summaryId = 4402
  private val group = "cpool_live"

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not ready" }
  private val draw by lazy { CpoolDraw(context) }
  private val island by lazy {
    CpoolIsland(context) { action, id ->
      sendEvent("onIslandAction", mapOf("action" to action, "id" to id))
    }
  }
  private var rideTask: Int? = null
  private var rideService = false

  override fun definition() = ModuleDefinition {
    Name("CpoolLive")

    // Ride buttons on Cpool's island and on the Live Update card: { action: "pickedup" (id: guest id) | "complete" | "incar" (guest) }.
    Events("onIslandAction")

    OnCreate { CpoolActionReceiver.listener = { action, id -> sendEvent("onIslandAction", mapOf("action" to action, "id" to id)) } }

    // options: { title, text, sub, when (header time, default now as "8:31"), progress (0-100, where the car is),
    //   vehicle ("car" | "bike"), color, tile ("vehicle" | "face"), gender, segments: [{ length, color }] adding up
    //   to 100, points: [{ at, color }], labels: [{ at, text }], phone, callLabel, share, url, chip,
    //   button: { label, action, id } (the ride step's button: Picked up / Complete ride / I'm in the car),
    //   island (host only): { text, ring (0-100), here (at a stop) } }
    // Phones with their own island get Android's Live Update (they put it in their island / top spot); others get
    // Cpool's demo card, plus Cpool's floating island for the host.
    Function("show") { options: Map<String, Any?> -> if (systemIsland()) postLive(options) else post(options) }

    // Does this phone show Live Updates in its own island? (Then Cpool doesn't float its own pill.)
    Function("hasSystemIsland") { systemIsland() }

    // Host taps Start ride: ride service and background task start now, while Cpool is still on screen.
    Function("startRide") { title: String? -> startRide(title) }

    // Ride over (or left the screen): card, island, ride service and background task all end.
    Function("cancel") { endAll() }

    // "Display over other apps": allowed? / open Android's switch for Cpool.
    Function("canShowIsland") { island.canShow() }
    Function("openIslandSettings") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { (appContext.currentActivity ?: context).startActivity(intent) }
    }

    // Short ride sounds ("accepted" | "cancelled" | "nearby"). Played with SoundPool as sound effects: a media player
    // would open a media session, and phones then show Cpool as a music player and hide its other notifications.
    Function("play") { name: String -> playSound(name) }

    // A line in Android's log (tag CpoolLive), for checking the ride flow on a phone.
    Function("log") { message: String -> android.util.Log.i("CpoolLive", message) }

    // The island only floats over other apps, never over Cpool itself.
    OnActivityEntersForeground { island.setAppVisible(true) }
    OnActivityEntersBackground { island.setAppVisible(false) }

    OnDestroy {
      endAll()
      CpoolActionReceiver.listener = null
      pool?.release()
    }
  }

  private fun manager(): NotificationManager = context.getSystemService(NotificationManager::class.java)

  @Suppress("DEPRECATION") // setPriority: still used by Android to order notifications of equal importance
  private fun post(o: Map<String, Any?>) {
    val ctx = context
    val nm = manager()
    ensureChannel()

    val title = o["title"] as? String ?: return
    val text = o["text"] as? String ?: ""
    val time = o["when"] as? String ?: SimpleDateFormat("h:mm", Locale.getDefault()).format(Date())
    val sub = " · ${o["sub"] as? String ?: "Pickup"} · $time"
    val color = colorOf(o["color"], "#1D4ED8")
    val bike = o["vehicle"] == "bike"
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val newTask = Intent.FLAG_ACTIVITY_NEW_TASK
    val tile = if (o["tile"] == "face") draw.faceTile(o["gender"] == "Female", 36f) else draw.vehicleTile(bike, color, 36f)
    // About the width the card gets inside the phone's notification frame.
    val barWidthDp = ctx.resources.displayMetrics.run { widthPixels / density } - 100f

    val small = RemoteViews(ctx.packageName, R.layout.cpool_live_small).apply {
      setTextViewText(R.id.cpool_live_title, title)
      setTextViewText(R.id.cpool_live_text, text)
    }
    val big = RemoteViews(ctx.packageName, R.layout.cpool_live_big).apply {
      setTextViewText(R.id.cpool_live_sub, sub)
      setTextViewText(R.id.cpool_live_title, title)
      setTextViewText(R.id.cpool_live_text, text)
      setImageViewBitmap(R.id.cpool_live_tile, tile)
      setImageViewBitmap(R.id.cpool_live_bar, draw.bar(o, bike, color, draw.compact, barWidthDp))
    }
    val phone = o["phone"] as? String
    if (phone != null) {
      val dial = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).addFlags(newTask)
      big.setTextViewText(R.id.cpool_live_call, o["callLabel"] as? String ?: "Call")
      big.setOnClickPendingIntent(R.id.cpool_live_call, PendingIntent.getActivity(ctx, 1, dial, flags))
    } else {
      big.setViewVisibility(R.id.cpool_live_call, View.GONE)
    }
    val share = o["share"] as? String
    if (share != null) {
      val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, share)
      big.setOnClickPendingIntent(R.id.cpool_live_share, PendingIntent.getActivity(ctx, 2, Intent.createChooser(send, "Share trip").addFlags(newTask), flags))
    } else {
      big.setViewVisibility(R.id.cpool_live_share, View.GONE)
    }
    if (phone == null && share == null) big.setViewVisibility(R.id.cpool_live_actions, View.GONE)

    val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(o["url"] as? String ?: "cpool:///coming"))
      .setPackage(ctx.packageName)
      .addFlags(newTask or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(ctx, 0, openIntent, flags)
    val smallIcon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName).takeIf { it != 0 } ?: ctx.applicationInfo.icon

    // Own group with a summary that never alerts, and the card set to alert only through the summary: it never pops
    // up as a banner and Android doesn't fold it under Cpool's other alerts.
    val summary = Notification.Builder(ctx, channelId)
      .setSmallIcon(smallIcon)
      .setColor(Color.parseColor("#1D4ED8"))
      .setContentTitle(title)
      .setGroup(group)
      .setGroupSummary(true)
      .setGroupAlertBehavior(Notification.GROUP_ALERT_CHILDREN)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(open)
      .build()
    val card = Notification.Builder(ctx, channelId)
      .setSmallIcon(smallIcon)
      .setColor(Color.parseColor("#1D4ED8"))
      // Plain title and text too, for screen readers and places that don't show custom layouts (watches, Auto).
      .setContentTitle(title)
      .setContentText(text)
      .setCustomContentView(small)
      .setCustomBigContentView(big)
      .setContentIntent(open)
      .setGroup(group)
      .setGroupAlertBehavior(Notification.GROUP_ALERT_SUMMARY)
      .setPriority(Notification.PRIORITY_MAX)
      // Whole card on the lock screen, as in the demo (ride details only, like Uber shows them).
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .build()
    nm.notify(summaryId, summary)
    nm.notify(notificationId, card)

    CpoolRideService.notification = card // the ride service (host or guest) always shows the latest card
    if (o["island"] != null) {
      startRide(null)
      island.update(o)
    }
  }

  // Host driving: the ride service and the background task, started on Start ride while Cpool is still on screen
  // (once Cpool is in the background the phone may pause it before they get going). Safe to call again.
  private fun startRide(title: String?) {
    val ctx = context
    // Android needs a notification to start the service: the ride card if there is one, else a plain placeholder.
    if (CpoolRideService.notification == null) CpoolRideService.notification = placeholder(title ?: "Your ride is starting")
    val located = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
      .any { ctx.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    if (!rideService && located) {
      rideService = runCatching { ctx.startForegroundService(Intent(ctx, CpoolRideService::class.java)) }.isSuccess
    }
    if (rideTask == null) {
      val rc = appContext.reactContext as? ReactContext ?: return
      // Front of the queue: the Drive screen's map loads on the same thread right after.
      Handler(Looper.getMainLooper()).postAtFrontOfQueue {
        if (rideTask == null) {
          // Timeout 0 = runs until finished; allowed while Cpool is open.
          rideTask = runCatching { HeadlessJsTaskContext.getInstance(rc).startTask(HeadlessJsTaskConfig("CpoolRide", Arguments.createMap(), 0, true)) }
            .onFailure { android.util.Log.w("CpoolLive", "background task failed: $it") }
            .getOrNull()
          android.util.Log.i("CpoolLive", "ride started: service=$rideService task=$rideTask")
        }
      }
    }
  }

  private fun placeholder(title: String): Notification {
    ensureChannel()
    val smallIcon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName).takeIf { it != 0 } ?: context.applicationInfo.icon
    return Notification.Builder(context, channelId)
      .setSmallIcon(smallIcon)
      .setColor(Color.parseColor("#1D4ED8"))
      .setContentTitle(title)
      .setContentText("Cpool")
      .setGroup(group)
      .setGroupAlertBehavior(Notification.GROUP_ALERT_SUMMARY)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .build()
  }

  private fun ensureChannel() {
    val nm = manager()
    if (nm.getNotificationChannel(channelId) != null) return
    nm.createNotificationChannel(
      NotificationChannel(channelId, "Live ride", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Host on the way and arrived · pinned card"
        setSound(null, null)
        enableVibration(false)
      },
    )
    if (nm.getNotificationChannel("live") != null) nm.deleteNotificationChannel("live")
  }

  private fun endAll() {
    island.end()
    rideTask?.let { id ->
      rideTask = null
      (appContext.reactContext as? ReactContext)?.let { rc -> UiThreadUtil.runOnUiThread { runCatching { HeadlessJsTaskContext.getInstance(rc).finishTask(id) } } }
    }
    if (rideService) {
      rideService = false
      runCatching { context.stopService(Intent(context, CpoolRideService::class.java)) }
    }
    CpoolRideService.notification = null
    runCatching {
      manager().cancel(notificationId)
      manager().cancel(summaryId)
    }
  }

  // ---------- phones with their own island: Android's Live Update ----------

  // Android 16.1+ when Live Updates are allowed, and vivo / iQOO on Android 16 (OriginOS 6 puts progress Live Updates
  // in its own island area; seen on Aswin's iQOO Neo 10R). Other brands: add here once tested on a real phone.
  private fun systemIsland(): Boolean {
    if (Build.VERSION.SDK_INT < 36) return false
    val promoted = runCatching { manager().javaClass.getMethod("canPostPromotedNotifications").invoke(manager()) as Boolean }.getOrDefault(false)
    return promoted || Build.MANUFACTURER.equals("vivo", ignoreCase = true)
  }

  // Android draws it in the phone's style; Cpool gives it the demo's colours: the bar (driven part, traffic ahead,
  // later legs), a dot per stop still ahead, the car in a white tile on the bar, the vehicle or next guest on the right.
  private fun postLive(o: Map<String, Any?>) {
    val ctx = context
    val nm = manager()
    nm.createNotificationChannel(
      NotificationChannel(liveChannel, "Live ride (island)", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Host on the way and arrived · in the phone's island"
        setSound(null, null)
        enableVibration(false)
      },
    )
    nm.cancel(summaryId) // the demo card's group summary isn't used here

    val title = o["title"] as? String ?: return
    val color = colorOf(o["color"], "#1D4ED8")
    val bike = o["vehicle"] == "bike"
    val progress = (CpoolDraw.num(o["progress"]) ?: 0f).roundToInt().coerceIn(0, 100)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val smallIcon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName).takeIf { it != 0 } ?: ctx.applicationInfo.icon
    val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(o["url"] as? String ?: "cpool:///coming"))
      .setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val tile = if (o["tile"] == "face") draw.faceTile(o["gender"] == "Female", 44f) else draw.vehicleTile(bike, color, 44f)

    val builder = Notification.Builder(ctx, liveChannel)
      .setSmallIcon(smallIcon)
      .setColor(Color.parseColor("#1D4ED8"))
      .setContentTitle(title)
      .setContentText(o["text"] as? String ?: "")
      .setSubText(o["sub"] as? String ?: "Pickup")
      .setLargeIcon(Icon.createWithBitmap(tile))
      .setContentIntent(PendingIntent.getActivity(ctx, 0, openIntent, flags))
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
    // The ride step's button first ("Picked up" / "Complete ride"): handled by the app without opening it.
    (o["button"] as? Map<*, *>)?.let { button ->
      val action = button["action"] as? String ?: return@let
      val tap = Intent(ctx, CpoolActionReceiver::class.java).putExtra("action", action).putExtra("id", button["id"] as? String)
      builder.addAction(Notification.Action.Builder(null as Icon?, button["label"] as? String ?: "Done", PendingIntent.getBroadcast(ctx, 3, tap, flags)).build())
    }
    (o["phone"] as? String)?.let { phone ->
      val dial = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      builder.addAction(Notification.Action.Builder(null as Icon?, o["callLabel"] as? String ?: "Call", PendingIntent.getActivity(ctx, 1, dial, flags)).build())
    }
    (o["share"] as? String)?.let { text ->
      val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
      val chooser = Intent.createChooser(send, "Share trip").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      builder.addAction(Notification.Action.Builder(null as Icon?, "Share trip", PendingIntent.getActivity(ctx, 2, chooser, flags)).build())
    }

    // Segment lengths are whole numbers: round the running total so they still add up to 100.
    val segments = mutableListOf<Notification.ProgressStyle.Segment>()
    var total = 0f
    var edge = 0
    for (s in CpoolDraw.maps(o["segments"])) {
      total += CpoolDraw.num(s["length"]) ?: continue
      val next = total.roundToInt().coerceIn(0, 100)
      if (next > edge) segments += Notification.ProgressStyle.Segment(next - edge).setColor(colorOf(s["color"], "#0F9D63"))
      edge = next
    }
    if (segments.isEmpty()) segments += Notification.ProgressStyle.Segment(100).setColor(Color.parseColor("#0F9D63"))
    // Stops still ahead of the car (Android drops passed ones and shows 4 at most).
    val points = CpoolDraw.maps(o["points"]).mapNotNull { p ->
      val at = CpoolDraw.num(p["at"])?.roundToInt()?.coerceIn(0, 100) ?: return@mapNotNull null
      if (at <= progress) null else Notification.ProgressStyle.Point(at).setColor(colorOf(p["color"], "#1D4ED8"))
    }.take(4)
    builder.setStyle(
      Notification.ProgressStyle()
        .setStyledByProgress(false)
        .setProgressSegments(segments)
        .setProgressPoints(points)
        .setProgressTrackerIcon(Icon.createWithBitmap(draw.trackerTile(bike, color)))
        .setProgress(progress),
    )
    // Live Update promotion and the status-bar chip (Android 16.1+), looked up by name so older phones skip it.
    invoke(builder, "setRequestPromotedOngoing", java.lang.Boolean.TYPE, true)
    (o["chip"] as? String)?.let { chip ->
      if (!invoke(builder, "setShortCriticalText", String::class.java, chip)) invoke(builder, "setShortCriticalText", CharSequence::class.java, chip)
    }

    val notification = builder.build()
    CpoolRideService.notification = notification // the ride service (host or guest) always shows the latest card
    // Host: ride service + background task with this card; no Cpool pill (the phone's island shows the ride).
    if (o["island"] != null) startRide(null)
    nm.notify(notificationId, notification)
  }

  private fun invoke(target: Any, name: String, type: Class<*>, value: Any): Boolean =
    runCatching { target.javaClass.getMethod(name, type).invoke(target, value) }.isSuccess

  // ---------- sounds ----------

  private val sounds = mapOf("accepted" to R.raw.cpool_accepted, "cancelled" to R.raw.cpool_cancelled, "nearby" to R.raw.cpool_nearby)
  private var pool: SoundPool? = null
  private val soundIds = mutableMapOf<String, Int>()
  private val loaded = mutableSetOf<Int>()
  private var waiting: Int? = null // first play of a sound: played as soon as it has loaded

  @Synchronized
  private fun playSound(name: String) {
    val res = sounds[name] ?: return
    val sp = pool ?: SoundPool.Builder()
      .setMaxStreams(2)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      .build()
      .also { created ->
        pool = created
        created.setOnLoadCompleteListener { p, id, status -> onLoaded(p, id, status) }
      }
    val id = soundIds.getOrPut(name) { sp.load(context, res, 1) }
    if (id in loaded) sp.play(id, 1f, 1f, 1, 0, 1f) else waiting = id
  }

  @Synchronized
  private fun onLoaded(p: SoundPool, id: Int, status: Int) {
    if (status != 0) return
    loaded += id
    if (waiting == id) {
      waiting = null
      p.play(id, 1f, 1f, 1, 0, 1f)
    }
  }
}
