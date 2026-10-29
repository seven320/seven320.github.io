# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""行った国を塗った世界地図(images/world-map.svg)と、写真の地球儀に使う国の形(images/globe.json)を作る。

使い方:
  curl -sL -o /tmp/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
  curl -sL -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
  uv run scripts/build_world_map.py /tmp/countries-110m.json /tmp/countries-50m.json

平らな地図は粗い 110m、地球儀は小さな島まで載っている 50m を使う(50m を省くと地球儀も 110m で作る)。

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
# 地球儀は直径300pxほどなので、これより細かい海岸線の凹凸は間引く(度)
GLOBE_TOLERANCE = 0.08
OUT = Path(__file__).resolve().parent.parent / "images" / "world-map.svg"
GLOBE_OUT = OUT.with_name("globe.json")


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
        # ページに直接埋め込んでも他の SVG に効かないように、スタイルは .world-map の中だけにする
        f'<svg xmlns="http://www.w3.org/2000/svg" class="world-map" viewBox="0 0 {WIDTH} {height:.0f}" role="img" aria-label="行った国の世界地図">',
        "  <style>",
        "    .world-map path { fill: #243049; stroke: #0b0f17; stroke-width: 0.5; }",
        "    .world-map .visited { fill: #38e1c4; }",
        "  </style>",
        *paths,
        "</svg>",
        "",
    ])
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT} ({len(VISITED) + len(VISITED_POINTS)} places, {len(svg) // 1024}KB)")


def simplify(points, tolerance):
    """Douglas-Peucker で、線から tolerance より近い点を間引く(両端は残す)"""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    if (x1, y1) == (x2, y2):
        # 閉じた線(島1つぶん)は、いちばん遠い点で2つに分けてから間引く
        far = max(range(len(points)), key=lambda i: (points[i][0] - x1) ** 2 + (points[i][1] - y1) ** 2)
        if far == 0:
            return points[:1] + points[-1:]
        return simplify(points[: far + 1], tolerance)[:-1] + simplify(points[far:], tolerance)
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1
    distances = [abs(dy * (x - x1) - dx * (y - y1)) / length for x, y in points[1:-1]]
    i = max(range(len(distances)), key=distances.__getitem__)
    if distances[i] <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[: i + 2], tolerance)[:-1] + simplify(points[i + 1 :], tolerance)


def build_globe(topo_path):
    """地球儀用に、緯度経度のままの国の形 (TopoJSON) を書き出す。行った国には visited を付ける"""
    topo = json.loads(Path(topo_path).read_text(encoding="utf-8"))
    arcs = decode_arcs(topo)
    geometries = []
    for geometry in topo["objects"]["countries"]["geometries"]:
        name = geometry["properties"]["name"]
        excluded = NOT_VISITED_PARTS.get(name)
        visited_polygons = []
        other_polygons = []
        for polygon in polygons(geometry):
            first = ring_points(polygon[0], arcs)[0]
            if name in VISITED and not (excluded and excluded(*first)):
                visited_polygons.append(polygon)
            else:
                other_polygons.append(polygon)
        # 行った部分と行っていない部分(フランス領ギアナなど)を分けておく
        for parts, visited in ((visited_polygons, True), (other_polygons, False)):
            if parts:
                properties = {"name": name, "visited": 1} if visited else {"name": name}
                geometries.append({"type": "MultiPolygon", "arcs": parts, "properties": properties})

    # 隣の国と共有している境界線も1本ずつ間引くので、国のあいだに隙間はできない
    # 0.01°刻みの整数にそろえる(TopoJSON の quantize と同じ形で小さくなる)
    step = 0.01
    snapped = []
    index_near_pole = []
    for arc in arcs:
        # 南極の南の縁のように極を回る線は、平らに見ると一直線でも間引くと極を回らなくなるのでそのまま使う
        near_pole = any(abs(lat) > 85 for _, lat in arc)
        index_near_pole.append(near_pole)
        points = [(round((lon + 180) / step), round((lat + 90) / step)) for lon, lat in (arc if near_pole else simplify(arc, GLOBE_TOLERANCE))]
        snapped.append(points[:1] + [q for p, q in zip(points, points[1:]) if q != p])

    def signed_area(ring, source):
        points = []
        for index in ring:
            arc = source[index] if index >= 0 else source[~index][::-1]
            points.extend(arc if not points else arc[1:])
        return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:])) / 2

    # 間引いて潰れた輪(面積0)や向きが裏返った輪は、d3 が「輪の外側=地球全体」と取り違えて
    # 回している途中にちらつくので捨てる
    def keep(ring):
        # 南極のように極を回る輪は、緯度経度のまま面積を測るとほぼ0になって向きが分からないので残す
        if any(index_near_pole[i if i >= 0 else ~i] for i in ring):
            return True
        area = signed_area(ring, snapped)
        return area != 0 and (area > 0) == (signed_area(ring, arcs) > 0)

    for geometry in geometries:
        geometry["arcs"] = [[ring for ring in polygon if keep(ring)] for polygon in geometry["arcs"] if keep(polygon[0])]
    geometries = [g for g in geometries if g["arcs"]]

    # 使わなくなった線を除いて番号を詰め、前の点との差で書く
    used = sorted({i if i >= 0 else ~i for g in geometries for polygon in g["arcs"] for ring in polygon for i in ring})
    renumber = {old: new for new, old in enumerate(used)}
    for geometry in geometries:
        geometry["arcs"] = [[[renumber[i] if i >= 0 else ~renumber[~i] for i in ring] for ring in polygon] for polygon in geometry["arcs"]]
    simplified = []
    for old in used:
        x0 = y0 = 0
        encoded = []
        for x, y in snapped[old]:
            encoded.append([x - x0, y - y0])
            x0, y0 = x, y
        simplified.append(encoded)
    globe = {
        "type": "Topology",
        "transform": {"scale": [step, step], "translate": [-180, -90]},
        "arcs": simplified,
        "objects": {"countries": {"type": "GeometryCollection", "geometries": geometries}},
        # 地図データの形が小さすぎて見えない島 (経度, 緯度)
        "points": VISITED_POINTS,
    }
    GLOBE_OUT.write_text(json.dumps(globe, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    before = sum(len(a) for a in arcs)
    after = sum(len(a) for a in simplified)
    print(f"wrote {GLOBE_OUT} ({before} -> {after} points, {GLOBE_OUT.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main(sys.argv[1])
    build_globe(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])
