// The app's ride math: where the car is, the meet point, the progress bar's traffic, and clock times.
// Run with `npm test` in frontend/.
import assert from "node:assert/strict";
import { test } from "node:test";
import { clockPlus, walkUrl } from "../src/lib/directions.js";
import { along, bearing, km, liveBar, nearestIndex, trafficSegments } from "../src/lib/route.js";

const line = [[77.6, 12.9], [77.61, 12.9], [77.62, 12.9]]; // two equal stretches going east
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("clockPlus keeps the 12-hour clock across noon and midnight", () => {
  assert.equal(clockPlus("8:35", -15), "8:20");
  assert.equal(clockPlus("12:05", -15), "11:50");
  assert.equal(clockPlus("11:50", 20), "12:10");
  assert.equal(clockPlus("0:05", -15), "11:50"); // was "-1:-10"
});

test("km measures real distance", () => {
  const d = km([77.6, 12.9], [77.61, 12.9]); // 0.01° of longitude near Bengaluru ≈ 1.08 km
  assert.ok(d > 1.07 && d < 1.1, String(d));
});

test("along places the car by distance travelled", () => {
  assert.deepEqual(along(line, 0).point, line[0]);
  assert.deepEqual(along(line, 1).point, line[2]);
  assert.ok(near(along(line, 0.25).point[0], 77.605, 1e-6));
  const half = along(line, 0.5);
  assert.ok(near(half.point[0], 77.61));
  assert.equal(half.done.length, 2); // the start, then the car
});

test("along gives the same answers as walking the route point by point", () => {
  // The version before the speed-up, kept here as the reference.
  const reference = (coords, t) => {
    let target = coords.slice(1).reduce((sum, p, i) => sum + km(coords[i], p), 0) * Math.min(1, Math.max(0, t));
    for (let i = 1; i < coords.length; i++) {
      const seg = km(coords[i - 1], coords[i]);
      if (target <= seg || i === coords.length - 1) {
        const r = seg ? Math.min(1, target / seg) : 0;
        const a = coords[i - 1], b = coords[i];
        const point = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
        return { point, heading: bearing(a, b), done: [...coords.slice(0, i), point] };
      }
      target -= seg;
    }
    return { point: coords[0], heading: 0, done: [coords[0]] };
  };
  const route = Array.from({ length: 60 }, (_, i) => [77.6 + i * 0.001 + (i % 3) * 0.0003, 12.9 + Math.sin(i) * 0.002]);
  for (const t of [0, 0.013, 0.33, 0.5, 0.77, 0.999, 1]) {
    const got = along(route, t);
    const want = reference(route, t);
    assert.ok(near(got.point[0], want.point[0]) && near(got.point[1], want.point[1]), `point at t=${t}`);
    assert.equal(got.done.length, want.done.length, `driven part at t=${t}`);
    assert.ok(near(got.heading, want.heading), `heading at t=${t}`);
  }
});

test("nearestIndex finds where a guest joins the host's route", () => {
  assert.equal(nearestIndex(line, [77.611, 12.9004]), 1);
  assert.equal(nearestIndex(line, [77.7, 12.95]), 2);
});

test("trafficSegments colours the route by traffic and adds up to 100", () => {
  const congestion = ["low", "heavy"];
  const bar = trafficSegments(line, congestion);
  assert.deepEqual(bar, [{ length: 50, color: "#0F9D63" }, { length: 50, color: "#DC2626" }]);
  assert.equal(trafficSegments(line, congestion), bar); // worked out once per route
  assert.equal(trafficSegments(line, null), null); // no traffic data
});

test("liveBar splits the trip into driven, ahead and later parts that add up to 100", () => {
  const parts = liveBar(40, 0, 100, null);
  assert.deepEqual(parts.map((p) => p.color), ["#AAB6D3", "#0F9D63"]);
  assert.ok(near(parts.reduce((sum, p) => sum + p.length, 0), 100));
  const legs = liveBar(30, 20, 60, [{ length: 100, color: "#0F9D63" }]);
  assert.ok(near(legs.reduce((sum, p) => sum + p.length, 0), 100));
});

test("walkUrl opens Google Maps walking directions to [lng, lat]", () => {
  assert.equal(walkUrl([77.6, 12.9]), "https://www.google.com/maps/dir/?api=1&destination=12.9,77.6&travelmode=walking");
});
