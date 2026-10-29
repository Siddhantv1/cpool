"""Distances on a route line, in plain Python (no PostGIS). Points are [lng, lat]."""

import math


def km(a, b):
    """Straight-line distance in km between two points (haversine)."""
    dlat, dlng = math.radians(b[1] - a[1]), math.radians(b[0] - a[0])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[1])) * math.cos(math.radians(b[1])) * math.sin(dlng / 2) ** 2
    return 12742.0 * math.asin(math.sqrt(h))


def length_km(route):
    return sum(km(a, b) for a, b in zip(route, route[1:]))


def nearest(route, p):
    """Closest point on the route line to p.

    Returns (point, km_from_p, km_along_route, segment_index). Uses a flat projection around p, which is
    accurate to metres at city scale.
    """
    kx, ky = math.cos(math.radians(p[1])) * 111.320, 110.574  # km per degree of lng / lat here
    best, along = None, 0.0
    for i, (a, b) in enumerate(zip(route, route[1:])):
        ax, ay = (a[0] - p[0]) * kx, (a[1] - p[1]) * ky
        dx, dy = (b[0] - a[0]) * kx, (b[1] - a[1]) * ky
        seg2 = dx * dx + dy * dy
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
        dist = math.hypot(ax + t * dx, ay + t * dy)
        seg = km(a, b)
        if best is None or dist < best[1]:
            point = [round(a[0] + t * (b[0] - a[0]), 6), round(a[1] + t * (b[1] - a[1]), 6)]
            best = (point, dist, along + t * seg, i)
        along += seg
    return best
