import AppKit
import CoreGraphics
import Foundation

struct ForegroundApplication: Encodable {
  let bundleId: String
  let executablePath: String?
  let title: String
}

guard let application = NSWorkspace.shared.frontmostApplication else {
  exit(0)
}

let pid = application.processIdentifier
let title = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]])?
  .first(where: { ($0[kCGWindowOwnerPID as String] as? pid_t) == pid })?[kCGWindowName as String] as? String ?? ""

let result = ForegroundApplication(
  bundleId: application.bundleIdentifier ?? application.localizedName ?? "",
  executablePath: application.executableURL?.path,
  title: title
)
let encoder = JSONEncoder()
if let json = try? encoder.encode(result), let output = String(data: json, encoding: .utf8) {
  print(output)
}
