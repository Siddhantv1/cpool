import AppIntents
import Foundation

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
    let defaults = UserDefaults.standard
    defaults.set(action, forKey: "cpool.live.action")
    if let id {
      defaults.set(id, forKey: "cpool.live.action.id")
    } else {
      defaults.removeObject(forKey: "cpool.live.action.id")
    }
    NotificationCenter.default.post(name: Notification.Name("cpoolLiveAction"), object: nil)
    return .result()
  }
}
