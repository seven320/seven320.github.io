"""行った国を塗った世界地図(images/world-map.svg)を作る。

使い方:
  curl -sL -o /tmp/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
  python3 scripts/build_world_map.py /tmp/countries-110m.json

行った国を増やすときは VISITED に world-atlas の国名(英語)を足して再実行する。
"""
import html
import json
import math
import sys
from pathlib import Path

VISITED = [
    # アジア
    "Japan",
    "China",
    "Taiwan",
    "Mongolia",
    "Thailand",
    "Vietnam",
    "Laos",
    "Cambodia",
    "Nepal",
    "India",
    "Sri Lanka",
    "Malaysia",
    "Indonesia",
    "Philippines",
    # オセアニア
    "Australia",
    "New Zealand",
    # 中東・アフリカ
    "United Arab Emirates",
    "Jordan",
    "Israel",
    "Egypt",
    # 北中米
    "United States of America",
    "Mexico",
    "Cuba",
    "Belize",
    "Guatemala",
    # 南米
    "Ecuador",
    "Chile",
    "Bolivia",
    "Peru",
    "Argentina",
    "Falkland Is.",
    # ヨーロッパ
    "United Kingdom",
    "Italy",
    "France",
    # 南極
    "Antarctica",
]

# 地図データ(110m)に形が無い小さな島は点で描く (経度, 緯度)
VISITED_POINTS = {
    "Singapore": (103.8, 1.35),
    "South Georgia": (-36.6, -54.4),
}

# 本土以外の領土(フランス領ギアナなど)は行った国でも塗らない
NOT_VISITED_PARTS = {
    "France": lambda lon, lat: lon < -30,
}

WIDTH = 960
OUT = Path(__file__).resolve().parent.parent / "images" / "world-map.svg"


def natural_earth(lon, lat):
    """Natural Earth I 図法 (度 -> 平面座標)"""
    lam = math.radians(lon)
    phi = math.radians(lat)
    p2 = phi * phi
    p4 = p2 * p2
    x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, y


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)
    return arcs


def ring_points(ring, arcs):
    points = []
    for index in ring:
        arc = arcs[index] if index >= 0 else arcs[~index][::-1]
        points.extend(arc if not points else arc[1:])
    # 日付変更線をまたぐ輪(ロシア東端、フィジーなど)は西側を+360して地図の右にはみ出させる
    lons = [p[0] for p in points]
    if max(lons) - min(lons) > 180 and min(p[1] for p in points) > -60:
        points = [(lon + 360 if lon < 0 else lon, lat) for lon, lat in points]
    return points


def polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["arcs"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["arcs"]
    return []


def main(topo_path):
    topo = json.loads(Path(topo_path).read_text(encoding="utf-8"))
    arcs = decode_arcs(topo)
    geometries = topo["objects"]["countries"]["geometries"]

    names = {g["properties"]["name"] for g in geometries}
    missing = [name for name in VISITED if name not in names]
    if missing:
        sys.exit(f"world-atlas に無い国名: {missing}")

    x_max, _ = natural_earth(180, 0)
    scale = WIDTH / (2 * x_max)
    y_top = 84  # 北極付近は使わない
    y_bottom = -78  # 南極は上の方だけ見せる
    top = natural_earth(0, y_top)[1] * scale
    height = (natural_earth(0, y_top)[1] - natural_earth(0, y_bottom)[1]) * scale

    def project(lon, lat):
        x, y = natural_earth(lon, lat)
        return x * scale + WIDTH / 2, top - y * scale

    paths = []
    for geometry in geometries:
        name = geometry["properties"]["name"]
        visited_d = []
        other_d = []
        excluded = NOT_VISITED_PARTS.get(name)
        for polygon in polygons(geometry):
            rings = [ring_points(ring, arcs) for ring in polygon]
            d = "".join("M" + "L".join("%.1f,%.1f" % project(lon, lat) for lon, lat in ring) + "Z" for ring in rings)
            if name in VISITED and not (excluded and excluded(*rings[0][0])):
                visited_d.append(d)
            else:
                other_d.append(d)
        if visited_d:
            paths.append(f'  <path class="visited" d="{"".join(visited_d)}"><title>{html.escape(name)}</title></path>')
        if other_d:
            paths.append(f'  <path d="{"".join(other_d)}"><title>{html.escape(name)}</title></path>')
    for name, (lon, lat) in VISITED_POINTS.items():
        x, y = project(lon, lat)
        paths.append(f'  <circle class="visited" cx="{x:.1f}" cy="{y:.1f}" r="3"><title>{html.escape(name)}</title></circle>')

    svg = "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {height:.0f}" role="img" aria-label="行った国の世界地図">',
        "  <style>",
        "    path { fill: #243049; stroke: #0b0f17; stroke-width: 0.5; }",
        "    .visited { fill: #38e1c4; }",
        "  </style>",
        *paths,
        "</svg>",
        "",
    ])
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT} ({len(VISITED) + len(VISITED_POINTS)} places, {len(svg) // 1024}KB)")


if __name__ == "__main__":
    main(sys.argv[1])
