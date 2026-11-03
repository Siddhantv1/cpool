package expo.modules.cpoollive

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

// Runs while the host drives (started on Start ride, stopped on Complete ride / cancel). As a foreground service with
// the host's ride card as its notification, it stops the phone from pausing or killing Cpool in the background, so
// the island and the card keep updating while the host is in Google Maps. Type "location": the host is driving.
class CpoolRideService : Service() {
  companion object {
    // The host's ride card (set by CpoolLiveModule before starting the service; later updates go straight to the
    // notification manager under the same id).
    @Volatile var notification: Notification? = null
    const val NOTIFICATION_ID = 4401
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n = notification
    if (n == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    runCatching {
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      else startForeground(NOTIFICATION_ID, n)
    }.onFailure { stopSelf() }
    return START_NOT_STICKY
  }
}
