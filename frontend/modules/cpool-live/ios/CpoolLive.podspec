Pod::Spec.new do |s|
  s.name             = "CpoolLive"
  s.version          = "0.1.0"
  s.summary          = "Cpool live ride cards"
  s.license          = { :type => "MIT" }
  s.author           = "Perficient"
  s.homepage         = "https://github.com"
  s.platforms        = { :ios => "16.4" }
  s.swift_version    = "5.9"
  s.source           = { :path => "." }
  s.static_framework = true

  s.dependency "ExpoModulesCore"
  s.frameworks = "ActivityKit", "CoreLocation", "UIKit"
  s.source_files = "**/*.swift"
end
