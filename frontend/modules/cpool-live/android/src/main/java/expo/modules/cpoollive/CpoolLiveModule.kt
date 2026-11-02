package expo.modules.cpoollive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The live ride card: one pinned notification that updates as the host gets closer. On Android 16 it is a
// progress-centric Live Update (progress bar with the car or bike on it, chip in the status bar); older phones get a
// normal ongoing notification with a plain progress bar and the same text and buttons.
class CpoolLiveModule : Module() {
  private val channelId = "live"
  private val notificationId = 4401

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not ready" }

  override fun definition() = ModuleDefinition {
    Name("CpoolLive")

    // options: { title, text, sub, chip, progress (0-100), vehicle ("car" | "bike"), color ("#RRGGBB"), phone, share, url }
    Function("show") { options: Map<String, Any?> -> post(options) }

    Function("cancel") { manager().cancel(notificationId) }
  }

  private fun manager(): NotificationManager = context.getSystemService(NotificationManager::class.java)

  private fun post(o: Map<String, Any?>) {
    val ctx = context
    val nm = manager()
    if (nm.getNotificationChannel(channelId) == null) {
      val channel = NotificationChannel(channelId, "Live ride", NotificationManager.IMPORTANCE_DEFAULT)
      channel.description = "Host on the way and arrived · pinned card"
      channel.setSound(null, null)
      channel.enableVibration(false)
      nm.createNotificationChannel(channel)
    }

    val title = o["title"] as? String ?: return
    val progress = ((o["progress"] as? Number)?.toInt() ?: 0).coerceIn(0, 100)
    val color = runCatching { Color.parseColor(o["color"] as? String) }.getOrDefault(Color.DKGRAY)
    val vehicle = Icon.createWithResource(ctx, if (o["vehicle"] == "bike") R.drawable.cpool_live_bike else R.drawable.cpool_live_car).setTint(color)
    val smallIcon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName).takeIf { it != 0 } ?: ctx.applicationInfo.icon
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(o["url"] as? String ?: "cpool:///coming"))
      .setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

    val builder = Notification.Builder(ctx, channelId)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(o["text"] as? String ?: "")
      .setSubText(o["sub"] as? String ?: "Pickup")
      .setLargeIcon(vehicle)
      .setContentIntent(PendingIntent.getActivity(ctx, 0, openIntent, flags))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setCategory(Notification.CATEGORY_PROGRESS)

    (o["phone"] as? String)?.let { phone ->
      val dial = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      builder.addAction(Notification.Action.Builder(null as Icon?, "Call", PendingIntent.getActivity(ctx, 1, dial, flags)).build())
    }
    (o["share"] as? String)?.let { text ->
      val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
      val chooser = Intent.createChooser(send, "Share trip").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      builder.addAction(Notification.Action.Builder(null as Icon?, "Share trip", PendingIntent.getActivity(ctx, 2, chooser, flags)).build())
    }

    if (Build.VERSION.SDK_INT >= 36) {
      val style = Notification.ProgressStyle()
        .setStyledByProgress(false)
        .setProgressSegments(listOf(Notification.ProgressStyle.Segment(100).setColor(Color.parseColor("#0F9D63"))))
        .setProgressPoints(listOf(Notification.ProgressStyle.Point(100).setColor(Color.parseColor("#1D4ED8"))))
        .setProgressTrackerIcon(vehicle)
        .setProgress(progress)
      builder.setStyle(style)
    } else {
      builder.setProgress(100, progress, false)
    }

    // Live Update promotion and the status-bar chip text (Android 16 QPR1+). Looked up by name so phones and SDKs
    // without them simply skip it.
    invoke(builder, "setRequestPromotedOngoing", java.lang.Boolean.TYPE, true)
    (o["chip"] as? String)?.let { chip ->
      if (!invoke(builder, "setShortCriticalText", String::class.java, chip)) invoke(builder, "setShortCriticalText", CharSequence::class.java, chip)
    }

    nm.notify(notificationId, builder.build())
  }

  private fun invoke(target: Any, name: String, type: Class<*>, value: Any): Boolean =
    runCatching { target.javaClass.getMethod(name, type).invoke(target, value) }.isSuccess
}
