package expo.modules.cpoollive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Buttons on Android's Live Update card (phones with their own island): "Picked up" / "Complete ride". The tap comes
// here and goes to the app as an onIslandAction event, same as Cpool's own island; Cpool isn't brought to the front.
class CpoolActionReceiver : BroadcastReceiver() {
  companion object {
    // Set by CpoolLiveModule while the app is running (the ride service keeps it running during a ride).
    @Volatile var listener: ((action: String, id: String?) -> Unit)? = null
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.getStringExtra("action") ?: return
    listener?.invoke(action, intent.getStringExtra("id"))
  }
}
