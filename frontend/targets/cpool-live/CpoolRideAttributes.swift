import ActivityKit
import Foundation

// Must match the copy in frontend/modules/cpool-live/ios/CpoolLiveModule.swift exactly: ActivityKit pairs the app and
// the widget by this type's name and fields, and a mismatch makes the card silently disappear. Change both together.
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
