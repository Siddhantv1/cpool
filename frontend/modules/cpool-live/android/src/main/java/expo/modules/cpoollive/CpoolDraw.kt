package expo.modules.cpoollive

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.TypedValue

// Bitmaps for the live card and the host island, drawn with the approved demo's sizes and colours
// (cpool-guest-card.html / cpool-host-island.html). Sizes are in dp.
internal class CpoolDraw(private val context: Context) {
  // Bar sizes: compact = the card in the notification shade, full = the island's card over other apps.
  data class Dims(val track: Float, val bar: Float, val dot: Float, val ring: Float, val carW: Float, val carH: Float, val carR: Float, val icon: Float, val label: Float, val labelH: Float)
  val compact = Dims(track = 22f, bar = 5f, dot = 6f, ring = 2.5f, carW = 26f, carH = 22f, carR = 8f, icon = 16f, label = 10.5f, labelH = 14f)
  val full = Dims(track = 26f, bar = 6f, dot = 7f, ring = 3f, carW = 30f, carH = 26f, carR = 9f, icon = 20f, label = 11.5f, labelH = 16f)

  private val density get() = context.resources.displayMetrics.density

  // The progress bar with its labels. o: { progress, segments: [{ length, color }], points: [{ at, color }], labels: [{ at, text }] }.
  // widthDp: about the width it's shown at, so circles stay round when the image is scaled to fit.
  fun bar(o: Map<String, Any?>, bike: Boolean, color: Int, dims: Dims, widthDp: Float): Bitmap {
    val dm = context.resources.displayMetrics
    val d = density
    val w = (widthDp * d).toInt().coerceAtLeast((200 * d).toInt())
    val h = ((dims.track + dims.labelH) * d).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    val x0 = dims.carW / 2 * d
    val x1 = w - dims.carW / 2 * d
    fun x(at: Float) = x0 + (x1 - x0) * at.coerceIn(0f, 100f) / 100f
    val cy = dims.track / 2 * d
    val half = dims.bar / 2 * d

    // Segments with rounded ends and a small gap where the colour changes.
    val segments = maps(o["segments"]).ifEmpty { listOf(mapOf("length" to 100, "color" to "#0F9D63")) }
    var at = 0f
    segments.forEachIndexed { i, s ->
      val length = num(s["length"]) ?: return@forEachIndexed
      val left = x(at) + if (i > 0) 1.25f * d else 0f
      at += length
      val right = x(at) - if (i < segments.size - 1) 1.25f * d else 0f
      if (right > left) {
        p.color = colorOf(s["color"], "#0F9D63")
        c.drawRoundRect(left, cy - half, right, cy + half, half, half, p)
      }
    }

    // Stops: a coloured dot in a white ring with a faint outline.
    for (point in maps(o["points"])) {
      val px = x(num(point["at"]) ?: continue)
      p.color = 0x14000000
      c.drawCircle(px, cy, (dims.dot + 1) * d, p)
      p.color = Color.WHITE
      c.drawCircle(px, cy, dims.dot * d, p)
      p.color = colorOf(point["color"], "#1D4ED8")
      c.drawCircle(px, cy, (dims.dot - dims.ring) * d, p)
    }

    // The car (or bike) in a small white tile with a soft shadow.
    val cx = x(num(o["progress"]) ?: 0f)
    p.color = Color.WHITE
    p.setShadowLayer(2 * d, 0f, 1 * d, 0x40000000)
    c.drawRoundRect(RectF(cx - dims.carW / 2 * d, cy - dims.carH / 2 * d, cx + dims.carW / 2 * d, cy + dims.carH / 2 * d), dims.carR * d, dims.carR * d, p)
    p.clearShadowLayer()
    vehicleIcon(c, bike, color, cx, cy, dims.icon * d, simple = true)

    // Labels: first starts at the left end, last ends at the right end, others centred; overlapping ones skipped.
    p.color = Color.parseColor("#5E6577")
    p.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, dims.label, dm)
    p.fontFeatureSettings = "tnum"
    var lastRight = -1e9f
    for (label in maps(o["labels"])) {
      val t = label["text"] as? String ?: continue
      val a = num(label["at"]) ?: continue
      val tw = p.measureText(t)
      val left = when {
        a <= 0f -> x0 - dims.dot * d
        a >= 100f -> x1 + dims.dot * d - tw
        else -> x(a) - tw / 2
      }.coerceIn(0f, (w - tw).coerceAtLeast(0f))
      if (left < lastRight + 6 * d) continue
      c.drawText(t, left, h - 3 * d, p)
      lastRight = left + tw
    }
    return bmp
  }

  // The car (or bike) on an Android Live Update's bar: in a small white tile with a soft shadow. Square, so the
  // phone can scale it evenly.
  fun trackerTile(bike: Boolean, color: Int): Bitmap {
    val d = density
    val s = 32 * d
    val bmp = Bitmap.createBitmap(s.toInt(), s.toInt(), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = Color.WHITE
      setShadowLayer(1.5f * d, 0f, 1f * d, 0x40000000)
    }
    c.drawRoundRect(RectF(1 * d, 3 * d, s - 1 * d, s - 4 * d), 9 * d, 9 * d, p)
    vehicleIcon(c, bike, color, s / 2, s / 2 - 0.5f * d, 20 * d, simple = true)
    return bmp
  }

  // White rounded tile with the vehicle in its own colour (44dp full, 36dp compact).
  fun vehicleTile(bike: Boolean, color: Int, sizeDp: Float): Bitmap {
    val d = density
    val s = sizeDp * d
    val bmp = Bitmap.createBitmap(s.toInt(), s.toInt(), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    c.drawRoundRect(0f, 0f, s, s, s * 14f / 44f, s * 14f / 44f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE })
    vehicleIcon(c, bike, color, s / 2, s / 2, s * (if (bike) 38f else 36f) / 44f, simple = false)
    return bmp
  }

  private fun vehicleIcon(c: Canvas, bike: Boolean, color: Int, cx: Float, cy: Float, size: Float, simple: Boolean) {
    if (bike) {
      icon(c, R.drawable.cpool_live_bike_wheels, null, cx, cy, size)
      icon(c, R.drawable.cpool_live_bike, color, cx, cy, size)
    } else if (simple) {
      icon(c, R.drawable.cpool_live_car, color, cx, cy, size)
    } else {
      icon(c, R.drawable.cpool_live_tile_car, color, cx, cy, size)
      icon(c, R.drawable.cpool_live_tile_car_details, null, cx, cy, size)
    }
  }

  // Round avatar of a guest: the demo's illustrated face (no real photos in notifications).
  fun faceTile(female: Boolean, sizeDp: Float): Bitmap {
    val s = sizeDp * density
    val bmp = Bitmap.createBitmap(s.toInt(), s.toInt(), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    c.clipPath(Path().apply { addCircle(s / 2, s / 2, s / 2, Path.Direction.CW) })
    val hair = if (female) "#2B1B12" else "#111827"
    val skin = "#E0A983"
    c.drawColor(Color.parseColor(if (female) "#FCE7F3" else "#DBEAFE"))
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    // Box (left, top, width, height) and corner radii (top-left, top-right, bottom-right, bottom-left), as fractions of the size.
    fun part(l: Float, t: Float, w: Float, h: Float, color: String, vararg r: Float) {
      val radii = (if (r.size == 1) FloatArray(4) { r[0] } else r).flatMap { listOf(it * s, it * s) }.toFloatArray()
      p.color = Color.parseColor(color)
      c.drawPath(Path().apply { addRoundRect(RectF(l * s, t * s, (l + w) * s, (t + h) * s), radii, Path.Direction.CW) }, p)
    }
    if (female) part(.27f, .19f, .46f, .52f, hair, .23f, .23f, .08f, .08f)
    part(.14f, .7f, .72f, .5f, if (female) "#BE185D" else "#1D4ED8", .36f)
    part(.43f, .54f, .14f, .18f, skin, 0f)
    part(.32f, .22f, .36f, .4f, skin, .18f)
    part(.31f, .18f, .38f, .17f, hair, .19f, .19f, .1f, if (female) .02f else .06f)
    part(.42f, .41f, .04f, .04f, "#1F2937", .02f)
    part(.54f, .41f, .04f, .04f, "#1F2937", .02f)
    return bmp
  }

  // The island pill's progress ring: green arc on a faint track, 22dp (demo: conic ring with a 14dp hole).
  fun ring(percent: Int, sizeDp: Float = 22f): Bitmap {
    val d = density
    val s = sizeDp * d
    val bmp = Bitmap.createBitmap(s.toInt(), s.toInt(), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val stroke = 4 * d
    val box = RectF(stroke / 2, stroke / 2, s - stroke / 2, s - stroke / 2)
    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = stroke }
    p.color = 0x2EFFFFFF
    c.drawOval(box, p)
    p.color = Color.parseColor("#0F9D63")
    c.drawArc(box, -90f, 360f * percent.coerceIn(0, 100) / 100f, false, p)
    return bmp
  }

  // The island pill's round badge: brand-blue circle with the white car (white circle with a green car at a pickup).
  fun badge(here: Boolean, sizeDp: Float = 28f): Bitmap {
    val d = density
    val s = sizeDp * d
    val bmp = Bitmap.createBitmap(s.toInt(), s.toInt(), Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    c.drawCircle(s / 2, s / 2, s / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (here) Color.WHITE else Color.parseColor("#1D4ED8") })
    icon(c, R.drawable.cpool_live_car, if (here) Color.parseColor("#0F9D63") else Color.WHITE, s / 2, s / 2, 16 * d)
    return bmp
  }

  private fun icon(c: Canvas, res: Int, tint: Int?, cx: Float, cy: Float, size: Float) {
    val drawable = context.getDrawable(res)?.mutate() ?: return
    tint?.let { drawable.setTint(it) }
    drawable.setBounds((cx - size / 2).toInt(), (cy - size / 2).toInt(), (cx + size / 2).toInt(), (cy + size / 2).toInt())
    drawable.draw(c)
  }

  companion object {
    fun maps(value: Any?): List<Map<*, *>> = (value as? List<*>).orEmpty().filterIsInstance<Map<*, *>>()

    fun num(value: Any?): Float? = (value as? Number)?.toFloat()

    fun colorOf(value: Any?, fallback: String): Int =
      runCatching { Color.parseColor(value as String) }.getOrDefault(Color.parseColor(fallback))
  }
}
