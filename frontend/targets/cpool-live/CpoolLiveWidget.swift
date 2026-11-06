import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct CpoolLiveWidgetBundle: WidgetBundle {
  var body: some Widget {
    CpoolRideLiveActivity()
  }
}

struct CpoolRideLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CpoolRideAttributes.self) { context in
      // The card is always light (approved design), so its text uses light-mode colours even when the phone is in
      // dark mode; otherwise "Cpool" and the grey labels turn white on the light card.
      CpoolLockScreenCard(state: context.state)
        .environment(\.colorScheme, .light)
        .activityBackgroundTint(Color(cpoolHex: "#F7F8FA"))
        .activitySystemActionForegroundColor(Color(cpoolHex: "#0F172A"))
        .widgetURL(URL(string: context.state.url))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          CpoolTile(state: context.state, size: 40)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(context.state.chip)
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .foregroundStyle(Color(cpoolHex: context.state.color))
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(context.state.title)
              .font(.system(size: 15, weight: .bold, design: .rounded))
              .lineLimit(1)
            Text(context.state.text)
              .font(.system(size: 11, weight: .medium, design: .rounded))
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 9) {
            CpoolProgress(state: context.state, labels: true)
            CpoolActions(state: context.state)
          }
          .padding(.top, 3)
        }
      } compactLeading: {
        CpoolTile(state: context.state, size: 24)
      } compactTrailing: {
        Text(context.state.chip)
          .font(.system(size: 12, weight: .bold, design: .rounded))
          .foregroundStyle(Color(cpoolHex: context.state.color))
      } minimal: {
        CpoolRing(progress: context.state.island?.ring ?? context.state.progress, color: context.state.color)
      }
      .widgetURL(URL(string: context.state.url))
      .keylineTint(Color(cpoolHex: context.state.color))
    }
  }
}

private struct CpoolLockScreenCard: View {
  let state: CpoolRideAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 5) {
        Text("C")
          .font(.system(size: 11, weight: .black, design: .rounded))
          .foregroundStyle(.white)
          .frame(width: 20, height: 20)
          .background(Color(cpoolHex: "#0E6464"), in: RoundedRectangle(cornerRadius: 6))
        Text("Cpool")
          .font(.system(size: 12, weight: .bold, design: .rounded))
          .foregroundStyle(Color(cpoolHex: "#0F172A"))
        Text("· \(state.sub) · \(state.headerTime)")
          .font(.system(size: 11, weight: .semibold, design: .rounded))
          .foregroundStyle(Color(cpoolHex: "#667085"))
        Spacer()
        Text("LIVE")
          .font(.system(size: 9, weight: .black, design: .rounded))
          .foregroundStyle(Color(cpoolHex: "#15803D"))
      }

      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text(state.title)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(Color(cpoolHex: "#0F172A"))
            .lineLimit(1)
          Text(state.text)
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(Color(cpoolHex: "#667085"))
            .lineLimit(2)
        }
        Spacer(minLength: 4)
        CpoolTile(state: state, size: 48)
      }

      CpoolProgress(state: state, labels: true)
      CpoolActions(state: state)
    }
    .padding(14)
  }
}

private struct CpoolTile: View {
  let state: CpoolRideAttributes.ContentState
  let size: CGFloat

  var body: some View {
    Image(systemName: icon)
      .font(.system(size: size * 0.46, weight: .bold))
      .foregroundStyle(state.tile == "face" ? Color(cpoolHex: "#6D28D9") : Color(cpoolHex: state.color))
      .frame(width: size, height: size)
      .background(.white.opacity(0.96), in: RoundedRectangle(cornerRadius: size * 0.3))
  }

  private var icon: String {
    if state.tile == "face" {
      return state.gender == "Female" ? "person.crop.circle.fill" : "person.crop.circle"
    }
    return state.vehicle == "bike" ? "bicycle" : "car.side.fill"
  }
}

private struct CpoolProgress: View {
  let state: CpoolRideAttributes.ContentState
  let labels: Bool

  var body: some View {
    VStack(spacing: 5) {
      GeometryReader { proxy in
        let width = proxy.size.width
        ZStack(alignment: .leading) {
          HStack(spacing: 0) {
            ForEach(Array(state.segments.enumerated()), id: \.offset) { _, segment in
              Color(cpoolHex: segment.color)
                .frame(width: max(0, width * segment.length / 100))
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(Color(cpoolHex: "#D8DCE5"))
          .clipShape(Capsule())

          ForEach(Array(state.points.enumerated()), id: \.offset) { _, point in
            CpoolProgressPoint(point: point, width: width)
          }

          Image(systemName: state.vehicle == "bike" ? "bicycle" : "car.side.fill")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color(cpoolHex: state.color))
            .frame(width: 22, height: 22)
            .background(.white, in: RoundedRectangle(cornerRadius: 7))
            .offset(x: max(0, min(width - 22, width * state.progress / 100 - 11)))
        }
      }
      .frame(height: 22)

      if labels, !state.labels.isEmpty {
        // Each name sits under its stop's dot (label.at, 0–100, like Android): the first starts at its dot, the last
        // ends at it, the ones between are centred on it, and none run past the bar's ends.
        GeometryReader { proxy in
          let width = proxy.size.width
          let last = state.labels.count - 1
          ZStack(alignment: .topLeading) {
            ForEach(Array(state.labels.enumerated()), id: \.offset) { index, label in
              Text(label.text)
                .font(.system(size: 9, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .fixedSize()
                .alignmentGuide(.leading) { d in
                  let x = width * label.at / 100
                  let anchor = index == 0 ? 0 : index == last ? d.width : d.width / 2
                  return -min(max(0, x - anchor), max(0, width - d.width))
                }
            }
          }
        }
        .frame(height: 12)
      }
    }
  }
}

private struct CpoolProgressPoint: View {
  let point: CpoolRideAttributes.Point
  let width: CGFloat

  var body: some View {
    Circle()
      .fill(Color(cpoolHex: point.color))
      .overlay(Circle().stroke(.white, lineWidth: 2))
      .frame(width: 10, height: 10)
      .offset(x: max(0, min(width - 10, width * point.at / 100 - 5)))
  }
}

private struct CpoolActions: View {
  let state: CpoolRideAttributes.ContentState

  var body: some View {
    if state.phone != nil || state.button != nil || state.share != nil {
      HStack(spacing: 8) {
        if let phone = state.phone, let url = URL(string: "tel:\(phone)") {
          Link(destination: url) {
            Label(state.callLabel ?? "Call", systemImage: "phone.fill")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(CpoolActionStyle(color: "#E7EAF0", text: "#0F172A"))
        }

        if let button = state.button {
          if #available(iOS 17.0, *) {
            // Host actions run in the background (the host stays in Google Maps); the guest's "I'm in the car" opens Cpool.
            Group {
              if button.action == "pickedup" || button.action == "complete" {
                Button(intent: CpoolHostIntent(action: button.action, id: button.id)) {
                  Text(button.label).frame(maxWidth: .infinity)
                }
              } else {
                Button(intent: CpoolRideIntent(action: button.action, id: button.id)) {
                  Text(button.label).frame(maxWidth: .infinity)
                }
              }
            }
            .buttonStyle(CpoolActionStyle(color: "#0E8A63", text: "#FFFFFF"))
          } else if let url = URL(string: state.url) {
            Link(button.label, destination: url)
              .frame(maxWidth: .infinity)
              .buttonStyle(CpoolActionStyle(color: "#0E8A63", text: "#FFFFFF"))
          }
        } else if state.share != nil, let url = URL(string: state.url) {
          Link(destination: url) {
            Label("Share trip", systemImage: "square.and.arrow.up")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(CpoolActionStyle(color: "#E7EAF0", text: "#0F172A"))
        }
      }
      .font(.system(size: 12, weight: .bold, design: .rounded))
    }
  }
}

private struct CpoolActionStyle: ButtonStyle {
  let color: String
  let text: String

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(Color(cpoolHex: text))
      .padding(.vertical, 8)
      .padding(.horizontal, 10)
      .background(Color(cpoolHex: color).opacity(configuration.isPressed ? 0.7 : 1), in: Capsule())
  }
}

private struct CpoolRing: View {
  let progress: Double
  let color: String

  var body: some View {
    ZStack {
      Circle().stroke(.white.opacity(0.25), lineWidth: 3)
      Circle()
        .trim(from: 0, to: min(1, max(0, progress / 100)))
        .stroke(Color(cpoolHex: color), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
    .padding(2)
  }
}

private extension Color {
  init(cpoolHex value: String) {
    let hex = value.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var rgb: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&rgb)
    self.init(
      red: Double((rgb >> 16) & 0xff) / 255,
      green: Double((rgb >> 8) & 0xff) / 255,
      blue: Double(rgb & 0xff) / 255
    )
  }
}
