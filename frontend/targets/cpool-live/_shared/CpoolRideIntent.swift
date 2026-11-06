import AppIntents
import Foundation

// The island's buttons run in Cpool's own process: remember the tapped action, then tell the CpoolLive module, which
// hands it to JS as onIslandAction (same as Android). Kept in UserDefaults so a tap is still delivered if JS isn't
// listening yet; the module sends it once it is.
private func recordCpoolAction(_ action: String, id: String?) {
  let defaults = UserDefaults.standard
  defaults.set(action, forKey: "cpool.live.action")
  if let id {
    defaults.set(id, forKey: "cpool.live.action.id")
  } else {
    defaults.removeObject(forKey: "cpool.live.action.id")
  }
  NotificationCenter.default.post(name: Notification.Name("cpoolLiveAction"), object: nil)
}

// Guest "I'm in the car": opens Cpool on the riding screen.
@available(iOS 17.0, *)
struct CpoolRideIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Update Cpool ride"
  static var openAppWhenRun = true

  @Parameter(title: "Action") var action: String
  @Parameter(title: "Guest") var id: String?

  init() {}

  init(action: String, id: String?) {
    self.action = action
    self.id = id
  }

  func perform() async throws -> some IntentResult {
    recordCpoolAction(action, id: id)
    return .result()
  }
}

// Host "Picked up" / "Complete ride": done without opening Cpool, so the host stays in Google Maps (Cpool keeps
// running in the background through the drive's location updates).
@available(iOS 17.0, *)
struct CpoolHostIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Update hosted ride"
  static var openAppWhenRun = false

  @Parameter(title: "Action") var action: String
  @Parameter(title: "Guest") var id: String?

  init() {}

  init(action: String, id: String?) {
    self.action = action
    self.id = id
  }

  func perform() async throws -> some IntentResult {
    recordCpoolAction(action, id: id)
    return .result()
  }
}
