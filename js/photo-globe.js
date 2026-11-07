// 写真の束の横の地球儀。いちばん上の写真を撮った場所まで回してピンを刺す。
// 地図のライブラリと国の形は、はじめて写真を開いたときに読み込む。
// onPick(photo): ほかの撮影場所の点が押されたら、その場所の1枚目の写真を渡す。
function createPhotoGlobe(formatGeo, onPick) {
  var wrap = document.querySelector('.photo-globe-wrap');
  var canvas = document.querySelector('.photo-globe');
  var label = document.querySelector('.photo-globe-label');
  var countryLabel = document.querySelector('.photo-globe-country');
  var pulse = document.querySelector('.photo-globe-pulse');
  var zoomButtons = Array.from(document.querySelectorAll('.photo-globe-controls [data-zoom]'));
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!wrap || !ctx || !pulse || !window.fetch) return null;

  var LIBS = [
    'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
    'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
    'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'
  ];
  var TURN_MS = 900;     // 次の場所まで回る時間
  var MAX_ZOOM = 4;
  var DOT_HIT = 14;      // 撮影場所の点は小さいので、見た目より広い範囲で押せるようにする
  var DRAG_START = 4;    // これ以上動かしたらドラッグ(離してもクリック扱いにしない)
  // 色は About の世界地図 (images/world-map.svg) と揃える。
  var COLOR = {
    land: '#243049',
    visited: '#38e1c4',
    current: '#b4fbee',  // 写真を見ている国は明るく塗る
    border: 'rgba(9, 25, 34, 0.42)',
    graticule: 'rgba(164, 203, 214, 0.14)',
    pin: '#ffb454',
    dot: 'rgba(255, 180, 84, 0.75)',
    dotEdge: '#0b0f17'
  };

  var map = null;        // 読み込んだ地図 { countries, borders, graticule, islands, centers }
  var ready = null;      // 地図の読み込み(Promise)
  var places = null;     // 撮影場所 [{ lonLat, photo }]。同じ場所の写真は1枚目だけ
  var dots = [];         // 直前に描いた、押せる点の位置 [{ x, y, photo }]
  var active = false;
  var fresh = true;      // 開いてからまだ地球儀を出していない(最初は回り込まずにその場所を向ける)
  var request = 0;       // 読み込み待ちの間に写真が変わったら、古い結果は使わない
  var frame = 0;
  var rotation = [-140, -20];
  var turn = null;       // 回転アニメーション { from, to, start }
  var zoom = 1;
  var pinLonLat = null;
  var currentCountry = null;
  var pointers = new Map();
  var drag = null;       // { x, y, rotation, moved }
  var pinch = null;      // { distance, zoom }

  // ---- 倍率 ----
  function setZoom(value) {
    zoom = Math.max(1, Math.min(MAX_ZOOM, value));
    // ホイール・ピンチで中間の倍率になったときは、どのボタンも押していない状態にする。
    zoomButtons.forEach(function(button) {
      button.setAttribute('aria-pressed', String(Math.abs(zoom - Number(button.dataset.zoom)) < 0.05));
    });
    requestDraw();
  }
  zoomButtons.forEach(function(button) {
    button.addEventListener('click', function() { setZoom(Number(button.dataset.zoom)); });
  });
  canvas.addEventListener('wheel', function(e) {
    if (!map || !active) return;
    e.preventDefault();
    var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    setZoom(zoom * Math.exp(-Math.max(-120, Math.min(120, e.deltaY * unit)) * 0.003));
  }, { passive: false });

  // ---- ドラッグで回転、2本指のピンチで拡大・縮小、点を押して写真へ移動 ----
  function pinchDistance() {
    var p = Array.from(pointers.values());
    return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
  }
  // 指の本数が変わるたびに、ピンチかドラッグかを決め直す。
  // ピンチの後に残った指では続けて回せるが、離してもタップ(点の選択)にはしない。
  function resetGesture(afterPinch) {
    var p = Array.from(pointers.values());
    pinch = p.length === 2 ? { distance: pinchDistance(), zoom: zoom } : null;
    drag = p.length === 1 ? { x: p[0][0], y: p[0][1], rotation: rotation.slice(), moved: !!afterPinch } : null;
  }
  function dotAt(e) {
    var rect = canvas.getBoundingClientRect();
    var best = null;
    var bestDistance = DOT_HIT;
    dots.forEach(function(dot) {
      var d = Math.hypot(dot.x - (e.clientX - rect.left), dot.y - (e.clientY - rect.top));
      if (d < bestDistance) { best = dot; bestDistance = d; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', function(e) {
    if (!map || !active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
    resetGesture();
  });
  canvas.addEventListener('pointermove', function(e) {
    if (!pointers.has(e.pointerId)) {
      // ボタンを押していないマウス: 点の上だけ指の形にする
      if (e.pointerType === 'mouse') canvas.style.cursor = onPick && dotAt(e) ? 'pointer' : 'grab';
      return;
    }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pinch.distance > 0) setZoom(pinch.zoom * pinchDistance() / pinch.distance);
    if (!drag) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_START) return;
    drag.moved = true;
    // 指の下の地点が指についてくる速さで回す。南北はひっくり返らないよう ±90° で止める。
    var degreesPerPixel = 180 / Math.PI / (canvas.clientWidth * 0.46 * zoom);
    turn = null;
    rotation = [
      drag.rotation[0] + dx * degreesPerPixel,
      Math.max(-90, Math.min(90, drag.rotation[1] - dy * degreesPerPixel))
    ];
    canvas.style.cursor = 'grabbing';
    requestDraw();
  });
  function endPointer(e) {
    var wasPinch = !!pinch;
    var tapped = drag && !drag.moved;
    if (!pointers.delete(e.pointerId)) return;
    resetGesture(wasPinch);
    if (e.pointerType === 'mouse') canvas.style.cursor = 'grab';
    if (tapped && e.type === 'pointerup') {
      var dot = onPick && dotAt(e);
      if (dot) onPick(dot.photo);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  // ---- 地図の読み込み ----
  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function() {
        script.remove();
        reject(new Error('地図ライブラリの読み込みに失敗: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function load() {
    if (ready) return ready;
    var loaded = [
      function() { return window.d3 && d3.extent; },
      function() { return window.d3 && d3.geoPath; },
      function() { return window.topojson; }
    ];
    // d3-geo は d3-array を使うので順番に読む。読み込み済みのものは飛ばす。
    ready = LIBS.reduce(function(chain, src, i) {
      return chain.then(function() { if (!loaded[i]()) return loadScript(src); });
    }, Promise.resolve()).then(function() {
      // file:// ではローカル JSON を fetch できないため、同じデータの JS 版を読む。
      if (location.protocol === 'file:') {
        return window.PHOTO_GLOBE_DATA ||
          loadScript('js/globe-data.js').then(function() { return window.PHOTO_GLOBE_DATA; });
      }
      return fetch('images/globe.json').then(function(res) {
        return res.ok ? res.json() : Promise.reject(res.status);
      });
    }).then(function(topo) {
      var countries = topojson.feature(topo, topo.objects.countries).features;
      var points = topo.points || {};
      var centers = Object.assign({}, points);
      countries.forEach(function(f) {
        if (f.properties.visited) centers[f.properties.name] = d3.geoCentroid(f);
      });
      map = {
        countries: countries,
        borders: topojson.mesh(topo, topo.objects.countries, function(a, b) { return a !== b; }),
        graticule: d3.geoGraticule().step([30, 30])(),
        islands: Object.values(points),
        centers: centers
      };
    }).catch(function(error) {
      // 失敗は覚えず、次に写真を開いたときに読み直す。
      ready = null;
      wrap.hidden = true;
      throw error;
    });
    return ready;
  }

  function lonLatOf(photo) {
    return photo.geo ? [photo.geo[1], photo.geo[0]] : map.centers[photo.country];
  }

  function photoPlaces() {
    if (places) return places;
    var seen = {};
    places = [];
    (window.TRAVEL_PHOTOS || []).forEach(function(photo) {
      var lonLat = lonLatOf(photo);
      if (!lonLat || seen[lonLat]) return;
      seen[lonLat] = true;
      places.push({ lonLat: lonLat, photo: photo });
    });
    return places;
  }

  // ---- 回転 ----
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function updateRotation(now) {
    if (!turn) return;
    // 回し始めの時刻は、最初に描くコマの時刻にそろえる。
    if (turn.start === null) turn.start = now;
    var t = window.siteMotion.reduced ? 1 : Math.min(1, (now - turn.start) / TURN_MS);
    var k = ease(t);
    rotation = [0, 1].map(function(i) { return turn.from[i] + (turn.to[i] - turn.from[i]) * k; });
    if (t === 1) turn = null;
  }

  // ---- 描画。回転中と、倍率・向き・サイズが変わったときだけ描き直す ----
  function requestDraw() {
    if (active && map && !wrap.hidden && !frame) frame = requestAnimationFrame(loop);
  }

  function loop(now) {
    draw(now);
    frame = turn ? requestAnimationFrame(loop) : 0;
  }

  function fill(path, geometry, color) {
    ctx.beginPath();
    path(geometry);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function stroke(path, geometry, color, width) {
    ctx.beginPath();
    path(geometry);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function gradient(g, stops) {
    stops.forEach(function(stop) { g.addColorStop(stop[0], stop[1]); });
    return g;
  }

  function draw(now) {
    var size = canvas.clientWidth;
    if (!size) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.round(size * dpr);
    if (canvas.width !== px || canvas.height !== px) canvas.width = canvas.height = px;
    updateRotation(now);

    var c = size / 2;
    var radius = size * 0.46;
    var projection = d3.geoOrthographic().scale(radius * zoom).translate([c, c]).rotate(rotation);
    var path = d3.geoPath(projection, ctx);
    var front = [-rotation[0], -rotation[1]];
    function onFront(lonLat) { return d3.geoDistance(lonLat, front) < Math.PI / 2; }
    // 1倍はくっきりした丸い地球儀。拡大すると円が枠いっぱいまで広がり、縁の細い帯だけ背景に溶ける。
    // 1〜2倍の間はなめらかにつなぐ。円は枠からはみ出さず、枠の辺で地図がまっすぐ切れないようにする。
    var flat = Math.max(0, Math.min(1, zoom - 1));
    var outer = radius + (c - radius) * flat;
    var fade = size * 0.1 * flat;
    var visibleRadius = outer - fade / 2;  // 点やピンを出す(押せる)範囲

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, outer, 0, Math.PI * 2);
    ctx.clip();

    // 海の濃淡は地図と一緒に広げ、拡大したときに隅だけ暗くならないようにする。
    fill(path, { type: 'Sphere' }, gradient(
      ctx.createRadialGradient(size * 0.32, size * 0.27, 0, c, c, radius * zoom),
      [[0, '#193749'], [0.65, '#0c202e'], [1, '#080f1b']]
    ));
    stroke(path, map.graticule, COLOR.graticule, 0.5);
    map.countries.forEach(function(f) {
      var visited = f.properties.visited;
      fill(path, f, !visited ? COLOR.land : f.properties.name === currentCountry ? COLOR.current : COLOR.visited);
    });
    stroke(path, map.borders, COLOR.border, 0.6);

    ctx.fillStyle = COLOR.visited;
    map.islands.filter(onFront).forEach(function(lonLat) {
      var xy = projection(lonLat);
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ほかの写真の撮影場所は小さな点。今の写真の場所はピンで別に描く。
    dots = [];
    photoPlaces().forEach(function(place) {
      if (!onFront(place.lonLat) || String(place.lonLat) === String(pinLonLat)) return;
      var xy = projection(place.lonLat);
      if (Math.hypot(xy[0] - c, xy[1] - c) < visibleRadius) dots.push({ x: xy[0], y: xy[1], photo: place.photo });
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2.5, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.dot;
      ctx.fill();
      ctx.strokeStyle = COLOR.dotEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 控えめな陰影で球面の丸みを出す。拡大して平らな地図になるほど薄くする。
    if (flat < 1) {
      ctx.globalAlpha = 1 - flat;
      fill(path, { type: 'Sphere' }, gradient(
        ctx.createLinearGradient(size * 0.16, size * 0.12, size * 0.87, size * 0.86),
        [[0, 'rgba(189, 232, 239, 0.16)'], [0.42, 'rgba(8, 18, 30, 0)'], [1, 'rgba(2, 8, 18, 0.72)']]
      ));
      ctx.globalAlpha = 1;
    }
    // 拡大中は、描いた地図を「中心は不透明・縁に向かって透明」な円で切り抜く。
    if (fade > 0) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = gradient(
        ctx.createRadialGradient(c, c, outer - fade, c, c, outer),
        [[0, 'rgba(0, 0, 0, 1)'], [1, 'rgba(0, 0, 0, 0)']]
      );
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ピンは縁の外では出さない。場所が「付近」までしか分からないことは座標の横に文字で出す。
    var p = pinLonLat && onFront(pinLonLat) && projection(pinLonLat);
    var pinVisible = p && Math.hypot(p[0] - c, p[1] - c) < visibleRadius;
    // 波紋は CSS のアニメーション。回っている間は出さない。
    pulse.hidden = !pinVisible || !!turn;
    if (pinVisible) {
      pulse.style.left = canvas.offsetLeft + p[0] + 'px';
      pulse.style.top = canvas.offsetTop + p[1] + 'px';
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0], p[1] - 16);
      ctx.strokeStyle = COLOR.pin;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p[0], p[1] - 16, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.pin;
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- 外から呼ぶ関数 ----
  // 写真の場所まで回す。開いた直後は回り込まず、最初からその場所を向けて表示する。
  function show(photo) {
    var current = ++request;
    active = true;
    load().then(function() {
      if (!active || current !== request) return;
      var lonLat = lonLatOf(photo);
      if (!lonLat) return;
      wrap.hidden = false;
      pinLonLat = lonLat;
      currentCountry = photo.country;
      countryLabel.textContent = photo.country === 'United States of America' ? 'United States' : photo.country;
      label.textContent = photo.geo ? formatGeo(photo.geo, photo.geoApproximate) : 'おおよその位置';
      // 撮影場所を真ん中に向ける(拡大してもピンが中央に残る)。経度は差が180°以内になる方へ回す。
      var to = [-lonLat[0], -lonLat[1]];
      to[0] = rotation[0] + ((to[0] - rotation[0]) % 360 + 540) % 360 - 180;
      if (fresh) {
        rotation = to;
        turn = null;
        fresh = false;
      } else {
        turn = { from: rotation.slice(), to: to, start: null };
      }
      requestDraw();
    }, function() {});
  }

  function stop() {
    active = false;
    fresh = true;
    request++;
    cancelAnimationFrame(frame);
    frame = 0;
    turn = null;
    pointers.clear();
    resetGesture();
    pulse.hidden = true;
    wrap.hidden = true;
  }

  // 画面サイズが変わったらピンと波紋の位置も描き直す。
  window.addEventListener('resize', requestDraw);
  return { show: show, stop: stop };
}
