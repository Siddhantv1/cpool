package expo.modules.cpoollive

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Outline
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.cpoollive.CpoolDraw.Companion.colorOf
import kotlin.math.hypot

// The host's floating island (approved demo, cpool-host-island.html): a dark pill over other apps while driving,
// "Pick up Karthik · 6 min" with a ring that fills as the host gets closer (green at a pickup). Tap it for the full
// demo card; tap outside or the arrow to shrink it; drag it to move it. Hidden while Cpool itself is on screen, and
// only shown when the host has allowed "Display over other apps". All window work happens on the main thread.
internal class CpoolIsland(private val context: Context, private val onAction: (action: String, id: String?) -> Unit) {
  private val main = Handler(Looper.getMainLooper())
  private val draw = CpoolDraw(context)
  private val themed = ContextThemeWrapper(context, android.R.style.Theme_Material_Light_NoActionBar)
  private val wm get() = context.getSystemService(WindowManager::class.java)
  private val d get() = context.resources.displayMetrics.density
  private fun dp(v: Float) = (v * d).toInt()

  private var data: Map<String, Any?>? = null // latest ride state from the app
  private var appVisible = true
  private var root: FrameLayout? = null
  private var params: WindowManager.LayoutParams? = null
  private var expanded = false
  private var pillX = 0
  private var pillY = 0

  private lateinit var pill: LinearLayout
  private lateinit var pillBadge: ImageView
  private lateinit var pillRing: ImageView
  private lateinit var pillText: TextView
  private lateinit var card: View

  fun canShow(): Boolean = Settings.canDrawOverlays(context)

  fun update(o: Map<String, Any?>) = main.post {
    data = o
    render()
  }

  fun end() = main.post {
    data = null
    remove()
  }

  fun setAppVisible(visible: Boolean) = main.post {
    appVisible = visible
    render()
  }

  private fun render() {
    val o = data
    if (o == null || appVisible || !canShow()) return remove()
    if (root == null && !create()) return
    fill(o)
  }

  private fun create(): Boolean {
    pillY = dp(80f) // just below the status bar and a navigation banner; the frame adds its padding
    pillX = 0
    pillBadge = ImageView(themed)
    pillRing = ImageView(themed)
    pillText = TextView(themed).apply {
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
      typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
      maxLines = 1
    }
    pill = LinearLayout(themed).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(6f), 0, dp(14f), 0)
      elevation = 8 * d
      outlineProvider = rounded(20 * d) // the shadow follows the pill, not its square bounds
      addView(pillBadge, LinearLayout.LayoutParams(dp(28f), dp(28f)))
      addView(pillRing, LinearLayout.LayoutParams(dp(22f), dp(22f)).apply { marginStart = dp(8f) })
      addView(pillText, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8f) })
      setOnTouchListener(PillTouch())
    }
    card = LayoutInflater.from(themed).inflate(R.layout.cpool_island_card, null).apply {
      visibility = View.GONE
      outlineProvider = rounded(26 * d)
    }
    card.findViewById<View>(R.id.cpool_island_close).setOnClickListener { collapse() }
    card.findViewById<View>(R.id.cpool_island_body).setOnClickListener { openApp() }
    context.getDrawable(R.drawable.cpool_live_phone)?.let { icon ->
      icon.setBounds(0, 0, dp(15f), dp(15f))
      card.findViewById<TextView>(R.id.cpool_live_call).setCompoundDrawablesRelative(icon, null, null, null)
    }

    val frame = FrameLayout(themed).apply {
      // Room around the pill and card for their shadows.
      setPadding(dp(16f), dp(12f), dp(16f), dp(22f)) // enough room that the shadows aren't cut off at the window edge
      addView(pill, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, dp(40f), Gravity.CENTER_HORIZONTAL))
      addView(card, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
      setOnTouchListener { _, e ->
        if (e.actionMasked == MotionEvent.ACTION_OUTSIDE && expanded) collapse()
        false
      }
    }
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      x = pillX
      y = pillY
    }
    return runCatching { wm.addView(frame, lp) }
      .onSuccess {
        root = frame
        params = lp
        expanded = false
      }.isSuccess
  }

  private fun fill(o: Map<String, Any?>) {
    val island = o["island"] as? Map<*, *> ?: emptyMap<String, Any?>()
    val here = island["here"] == true
    pillText.text = island["text"] as? String ?: (o["title"] as? String ?: "")
    pill.contentDescription = "${pillText.text}. Tap to open."
    pill.background = GradientDrawable().apply {
      cornerRadius = 20 * d // exactly half the 40dp height, so the shadow follows the pill shape
      setColor(if (here) Color.parseColor("#0F9D63") else Color.parseColor("#0B1020"))
    }
    pillBadge.setImageBitmap(draw.badge(here))
    pillRing.visibility = if (here) View.GONE else View.VISIBLE
    if (!here) pillRing.setImageBitmap(draw.ring(CpoolDraw.num(island["ring"])?.toInt() ?: 0))
    if (expanded) fillCard(o, island)
  }

  // The full demo host card (only redrawn while it's open).
  private fun fillCard(o: Map<String, Any?>, island: Map<*, *>) {
    val color = colorOf(o["color"], "#1D4ED8")
    val bike = o["vehicle"] == "bike"
    card.findViewById<TextView>(R.id.cpool_live_sub).text = " · ${o["sub"] as? String ?: "Driving"} · ${o["when"] as? String ?: "now"}"
    card.findViewById<TextView>(R.id.cpool_live_title).text = o["title"] as? String ?: ""
    card.findViewById<TextView>(R.id.cpool_live_text).text = o["text"] as? String ?: ""
    card.findViewById<ImageView>(R.id.cpool_live_tile)
      .setImageBitmap(if (o["tile"] == "face") draw.faceTile(o["gender"] == "Female", 44f) else draw.vehicleTile(bike, color, 44f))
    val widthDp = context.resources.displayMetrics.widthPixels / d - 48f
    card.findViewById<ImageView>(R.id.cpool_live_bar).setImageBitmap(draw.bar(o, bike, color, draw.full, widthDp))

    val call = card.findViewById<TextView>(R.id.cpool_live_call)
    val phone = o["phone"] as? String
    call.visibility = if (phone != null) View.VISIBLE else View.GONE
    call.text = o["callLabel"] as? String ?: "Call"
    call.setOnClickListener { phone?.let { start(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$it"))) } }

    // The ride step's green button: "Picked up" at a guest's pickup, "Complete ride" at the destination.
    val picked = card.findViewById<TextView>(R.id.cpool_island_picked)
    val button = o["button"] as? Map<*, *>
    val action = button?.get("action") as? String
    picked.visibility = if (action != null) View.VISIBLE else View.GONE
    picked.text = button?.get("label") as? String ?: ""
    picked.setOnClickListener {
      picked.visibility = View.GONE // one tap only; the next update shows the next step
      if (action != null) onAction(action, button["id"] as? String)
      collapse()
    }
  }

  private fun expand() {
    val lp = params ?: return
    val frame = root ?: return
    pillX = lp.x
    pillY = lp.y
    expanded = true
    pill.visibility = View.GONE
    card.visibility = View.VISIBLE
    lp.width = WindowManager.LayoutParams.MATCH_PARENT
    lp.x = 0
    runCatching { wm.updateViewLayout(frame, lp) }
    data?.let { fill(it) }
  }

  private fun collapse() {
    val lp = params ?: return
    val frame = root ?: return
    expanded = false
    card.visibility = View.GONE
    pill.visibility = View.VISIBLE
    lp.width = WindowManager.LayoutParams.WRAP_CONTENT
    lp.x = pillX
    lp.y = pillY
    runCatching { wm.updateViewLayout(frame, lp) }
  }

  private fun remove() {
    root?.let { frame -> runCatching { wm.removeView(frame) } }
    root = null
    params = null
    expanded = false
  }

  private fun rounded(radius: Float) = object : ViewOutlineProvider() {
    override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(0, 0, view.width, view.height, radius)
  }

  private fun openApp() {
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { start(it) }
  }

  private fun start(intent: Intent) {
    runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
  }

  // Tap the pill to open the card; drag it to move it anywhere on screen.
  private inner class PillTouch : View.OnTouchListener {
    private var downX = 0f
    private var downY = 0f
    private var startX = 0
    private var startY = 0
    private var dragging = false
    private val slop = ViewConfiguration.get(context).scaledTouchSlop

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouch(v: View, e: MotionEvent): Boolean {
      val lp = params ?: return false
      val frame = root ?: return false
      when (e.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = e.rawX
          downY = e.rawY
          startX = lp.x
          startY = lp.y
          dragging = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = e.rawX - downX
          val dy = e.rawY - downY
          if (!dragging && hypot(dx, dy) > slop) dragging = true
          if (dragging) {
            lp.x = startX + dx.toInt()
            lp.y = (startY + dy.toInt()).coerceAtLeast(0)
            runCatching { wm.updateViewLayout(frame, lp) }
          }
        }
        MotionEvent.ACTION_UP -> if (!dragging) expand()
      }
      return true
    }
  }
}
