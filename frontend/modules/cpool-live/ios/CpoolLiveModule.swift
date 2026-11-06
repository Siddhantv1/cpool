import ActivityKit
import CoreLocation
import ExpoModulesCore
import UIKit

// Must match frontend/targets/cpool-live/CpoolRideAttributes.swift exactly: ActivityKit pairs the app and the widget by
// this type's name and fields, and a mismatch makes the card silently disappear. Change both together.
struct CpoolRideAttributes: ActivityAttributes {
  struct Segment: Codable, Hashable {
    let length: Double
    let color: String
  }

  struct Point: Codable, Hashable {
    let at: Double
    let color: String
  }

  struct Label: Codable, Hashable {
    let at: Double
    let text: String
  }

  struct RideButton: Codable, Hashable {
    let label: String
    let action: String
    let id: String?
  }

  struct Island: Codable, Hashable {
    let text: String
    let ring: Double
    let here: Bool
  }

  struct ContentState: Codable, Hashable {
    let style: String
    let title: String
    let text: String
    let sub: String
    let headerTime: String
    let chip: String
    let progress: Double
    let segments: [Segment]
    let points: [Point]
    let labels: [Label]
    let vehicle: String
    let color: String
    let tile: String
    let gender: String?
    let phone: String?
    let callLabel: String?
    let share: String?
    let button: RideButton?
    let island: Island?
    let url: String
  }

  let startedAt: Date
}

private final class CpoolLocationDelegate: NSObject, CLLocationManagerDelegate {
  let onTick: () -> Void

  init(onTick: @escaping () -> Void) {
    self.onTick = onTick
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard Self.allowed(manager.authorizationStatus) else { return }
    Self.start(manager)
  }

  // "While using the app" is enough: updates started on screen (Start ride) keep running while the host is in Google
  // Maps, with iOS's blue location pill. "Always" isn't needed.
  static func allowed(_ status: CLAuthorizationStatus) -> Bool {
    status == .authorizedAlways || status == .authorizedWhenInUse
  }

  static func start(_ manager: CLLocationManager) {
    manager.allowsBackgroundLocationUpdates = true
    manager.showsBackgroundLocationIndicator = true
    manager.startUpdatingLocation()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard locations.last != nil else { return }
    onTick()
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    NSLog("CpoolLive location: %@", error.localizedDescription)
  }
}

public final class CpoolLiveModule: Module {
  private var activity: Activity<CpoolRideAttributes>?
  private var activityTask: Task<Void, Never>?
  private var pushTask: Task<Void, Never>?
  private var pushToken: String?
  private var actionObserver: NSObjectProtocol?
  private var observingActions = false
  private var locationManager: CLLocationManager?
  private var locationDelegate: CpoolLocationDelegate?

  public func definition() -> ModuleDefinition {
    Name("CpoolLive")
    Events("onIslandAction", "onRideTick", "onPushToken")

    OnCreate {
      // A card left from before this launch (Cpool was closed mid-ride): its ride is gone, so end it instead of
      // adopting it; otherwise the Lock Screen keeps showing old minutes for up to 8 hours.
      let leftovers = Activity<CpoolRideAttributes>.activities
      if !leftovers.isEmpty {
        activityTask = Task {
          for leftover in leftovers {
            await leftover.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
      actionObserver = NotificationCenter.default.addObserver(
        forName: Notification.Name("cpoolLiveAction"),
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emitPendingAction()
      }
    }

    OnDestroy {
      if let actionObserver {
        NotificationCenter.default.removeObserver(actionObserver)
      }
      pushTask?.cancel()
      stopHostLocation()
    }

    OnStartObserving("onIslandAction") {
      observingActions = true
      emitPendingAction()
    }

    OnStopObserving("onIslandAction") {
      observingActions = false
    }

    OnAppBecomesActive {
      emitPendingAction()
    }

    Function("show") { (options: [String: Any]) in
      let state = makeState(options)
      let previous = activityTask
      activityTask = Task { [weak self] in
        await previous?.value
        await self?.show(state)
      }
    }

    Function("startRide") { (role: String?) in
      if role == "host" {
        DispatchQueue.main.async { [weak self] in self?.startHostLocation() }
      }
    }

    Function("cancel") {
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        stopHostLocation()
        let previous = activityTask
        activityTask = Task { [weak self] in
          await previous?.value
          await self?.endActivity()
        }
      }
    }

    Function("canShowIsland") { false }
    Function("openIslandSettings") {}
    Function("getPushToken") { pushToken }
    Function("hasSystemIsland") { () -> Bool in
      // shortcut: safe-area height is the only public signal, remove if Apple exposes an island capability API.
      if Thread.isMainThread { return systemIsland() }
      return DispatchQueue.main.sync { systemIsland() }
    }
  }

  private func systemIsland() -> Bool {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }
    return (window?.safeAreaInsets.top ?? 0) >= 51
  }

  private func show(_ state: CpoolRideAttributes.ContentState) async {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    // No update for 15 minutes (Cpool stopped) and iOS marks the card stale instead of showing old minutes as live.
    let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(15 * 60))
    if let activity {
      switch activity.activityState {
      case .active, .stale:
        await activity.update(content)
        return
      case .dismissed:
        return // removed from the Lock Screen by the person: don't bring it back for this ride
      default:
        break // ended, e.g. by iOS's 8-hour limit: start a new card below
      }
    }
    do {
      let attributes = CpoolRideAttributes(startedAt: Date())
      let created: Activity<CpoolRideAttributes>
      do {
        created = try Activity.request(attributes: attributes, content: content, pushType: .token)
      } catch {
        // shortcut: Personal Team builds have no APNs entitlement, retry locally until the paid team is enabled.
        created = try Activity.request(attributes: attributes, content: content, pushType: nil)
      }
      activity = created
      pushTask?.cancel() // the old card's token stream; watch the new card's instead
      pushTask = nil
      observePushToken(created)
    } catch {
      NSLog("CpoolLive: %@", error.localizedDescription)
    }
  }

  private func endActivity() async {
    pushTask?.cancel()
    pushTask = nil
    pushToken = nil
    let running = activity ?? Activity<CpoolRideAttributes>.activities.first
    activity = nil
    await running?.end(nil, dismissalPolicy: .immediate)
  }

  private func observePushToken(_ activity: Activity<CpoolRideAttributes>) {
    guard pushTask == nil else { return }
    pushTask = Task { [weak self] in
      for await data in activity.pushTokenUpdates {
        guard !Task.isCancelled else { return }
        let token = data.map { String(format: "%02x", $0) }.joined()
        self?.pushToken = token
        self?.sendEvent("onPushToken", ["activityId": activity.id, "token": token])
      }
    }
  }

  private func startHostLocation() {
    guard locationManager == nil else { return }
    let manager = CLLocationManager()
    let delegate = CpoolLocationDelegate { [weak self] in
      self?.sendEvent("onRideTick")
    }
    manager.delegate = delegate
    manager.activityType = .automotiveNavigation
    manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    manager.distanceFilter = 20
    manager.pausesLocationUpdatesAutomatically = false
    locationDelegate = delegate
    locationManager = manager
    if CpoolLocationDelegate.allowed(manager.authorizationStatus) {
      CpoolLocationDelegate.start(manager)
    } else if manager.authorizationStatus == .notDetermined {
      manager.requestWhenInUseAuthorization()
    }
  }

  private func stopHostLocation() {
    locationManager?.stopUpdatingLocation()
    locationManager = nil
    locationDelegate = nil
  }

  private func emitPendingAction() {
    guard observingActions else { return }
    let defaults = UserDefaults.standard
    guard let action = defaults.string(forKey: "cpool.live.action") else { return }
    let id = defaults.string(forKey: "cpool.live.action.id")
    defaults.removeObject(forKey: "cpool.live.action")
    defaults.removeObject(forKey: "cpool.live.action.id")
    sendEvent("onIslandAction", ["action": action, "id": id])
  }

  private func makeState(_ options: [String: Any]) -> CpoolRideAttributes.ContentState {
    let button = dictionary(options["button"]).flatMap { value -> CpoolRideAttributes.RideButton? in
      guard let action = value["action"] as? String else { return nil }
      return .init(label: value["label"] as? String ?? "Done", action: action, id: value["id"] as? String)
    }
    let island = dictionary(options["island"]).map {
      CpoolRideAttributes.Island(
        text: $0["text"] as? String ?? "",
        ring: number($0["ring"]),
        here: $0["here"] as? Bool ?? false
      )
    }
    return .init(
      style: options["style"] as? String ?? "card",
      title: options["title"] as? String ?? "Cpool",
      text: options["text"] as? String ?? "",
      sub: options["sub"] as? String ?? "Pickup",
      headerTime: options["when"] as? String ?? "now",
      chip: options["chip"] as? String ?? "Live",
      progress: number(options["progress"]),
      segments: dictionaries(options["segments"]).map {
        .init(length: number($0["length"]), color: $0["color"] as? String ?? "#1D4ED8")
      },
      points: dictionaries(options["points"]).map {
        .init(at: number($0["at"]), color: $0["color"] as? String ?? "#1D4ED8")
      },
      labels: dictionaries(options["labels"]).compactMap {
        guard let text = $0["text"] as? String else { return nil }
        return .init(at: number($0["at"]), text: text)
      },
      vehicle: options["vehicle"] as? String ?? "car",
      color: options["color"] as? String ?? "#1D4ED8",
      tile: options["tile"] as? String ?? "vehicle",
      gender: options["gender"] as? String,
      phone: options["phone"] as? String,
      callLabel: options["callLabel"] as? String,
      share: options["share"] as? String,
      button: button,
      island: island,
      url: options["url"] as? String ?? "cpool:///coming"
    )
  }

  private func dictionaries(_ value: Any?) -> [[String: Any]] {
    (value as? [Any])?.compactMap(dictionary) ?? []
  }

  private func dictionary(_ value: Any?) -> [String: Any]? {
    value as? [String: Any]
  }

  private func number(_ value: Any?) -> Double {
    (value as? NSNumber)?.doubleValue ?? 0
  }
}
