import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, View } from "react-native";

const road = require("../../assets/images/vehicle/car-bg.png");
const body = require("../../assets/images/vehicle/car-body.png");
const wheel = require("../../assets/images/vehicle/car-wheel.png");

// Wheel centres and size in the 400 × 170 drawing the images come from; scaled to the box width in pixels
// (Image ignores aspectRatio with a % width on Android, which stretched the wheels).
const WHEEL = 44.16;
const wheelStyle = (cx, w) => {
  const k = w / 400;
  return { position: "absolute", left: (cx - WHEEL / 2) * k, top: (113.36 - WHEEL / 2) * k, width: WHEEL * k, height: WHEEL * k };
};

// Sports car that drives in, waits, drives off, on a loop, wheels spinning. Stands still if the phone asks for less motion.
export default function DrivingCar({ radius }) {
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!width) return;
    let loops = [];
    let alive = true;
    // One lap: in from the left, pause, off to the right. Restarted from its own end callback, because
    // Animated.loop around a sequence with a jump back only played once on Android.
    const lap = () => {
      if (!alive) return;
      x.setValue(-width);
      const run = Animated.sequence([
        Animated.timing(x, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(x, { toValue: width * 1.1, duration: 650, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]);
      loops[0] = run;
      run.start(({ finished }) => finished && lap());
    };
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || !alive) return;
      loops[1] = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 250, easing: Easing.linear, useNativeDriver: true }));
      loops[1].start();
      lap();
    });
    return () => {
      alive = false;
      loops.forEach((l) => l?.stop());
    };
  }, [width, x, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible={false} style={{ width: "100%", aspectRatio: 400 / 170, borderRadius: radius, overflow: "hidden" }}>
      <Image source={road} style={{ position: "absolute", width: "100%", height: "100%" }} />
      <Animated.View style={{ position: "absolute", width: "100%", height: "100%", transform: [{ translateX: x }] }}>
        <Image source={body} style={{ position: "absolute", width: "100%", height: "100%" }} />
        <Animated.Image source={wheel} style={[wheelStyle(103.84, width), { transform: [{ rotate }] }]} />
        <Animated.Image source={wheel} style={[wheelStyle(301.64, width), { transform: [{ rotate }] }]} />
      </Animated.View>
    </View>
  );
}
