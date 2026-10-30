// 写真の束の横の地球儀。いちばん上の写真を撮った場所まで回してピンを刺す
// 地図のライブラリと国の形は、はじめて写真を開いたときに読み込む
function createPhotoGlobe(formatGeo) {
  var wrap = document.querySelector('.photo-globe-wrap');
  var canvas = document.querySelector('.photo-globe');
  var label = document.querySelector('.photo-globe-label');
  var countryLabel = document.querySelector('.photo-globe-country');
  var pulse = document.querySelector('.photo-globe-pulse');
  if (!wrap || !canvas || !pulse || !canvas.getContext || !window.fetch) return null;
  var LIBS = [
    'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
    'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
    'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'
  ];
  var TURN = 900;  // 次の場所まで回る時間(ms)
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ready = null;
  var countries = [];
  var islands = [];
  var centers = {};
  var graticule = null;
  var borders = null;
  var rotation = [-140, -20];
  var turn = null;   // { from, to, start }
  var pin = null;    // { lonLat, exact }
  var frame = 0;
  var ctx = canvas.getContext('2d');
  if (!ctx) return null;
  var sphere = { type: 'Sphere' };

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function load() {
    if (ready) return ready;
    // d3-geo は d3-array を使うので順番に読む
    ready = LIBS.reduce(function(chain, src) {
      return chain.then(function() { return loadScript(src); });
    }, Promise.resolve()).then(function() {
      return fetch('images/globe.json');
    }).then(function(res) {
      return res.ok ? res.json() : Promise.reject(res.status);
    }).then(function(topo) {
      countries = topojson.feature(topo, topo.objects.countries).features;
      countries.forEach(function(f) {
        if (f.properties.visited) centers[f.properties.name] = d3.geoCentroid(f);
      });
      Object.keys(topo.points || {}).forEach(function(name) {
        centers[name] = topo.points[name];
        islands.push(topo.points[name]);
      });
      graticule = d3.geoGraticule().step([30, 30])();
      borders = topojson.mesh(topo, topo.objects.countries, function(a, b) { return a !== b; });
      wrap.hidden = false;
    });
    ready.catch(function() { wrap.hidden = true; });
    return ready;
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function updateRotation(now) {
    if (!turn) return;
    // 回し始めの時刻は、最初に描くときのコマの時刻にそろえる
    if (turn.start === null) turn.start = now;
    var t = reduceMotion ? 1 : Math.min(1, (now - turn.start) / TURN);
    var k = ease(t);
    rotation = [turn.from[0] + (turn.to[0] - turn.from[0]) * k, turn.from[1] + (turn.to[1] - turn.from[1]) * k];
    if (t === 1) turn = null;
  }

  // 塗りと線を描く共通処理。色と太さは呼び出し側で指定する。
  function paint(path, geometry, fill, stroke, width) {
    ctx.beginPath();
    path(geometry);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function gradientColors(gradient, stops) {
    stops.forEach(function(stop) { gradient.addColorStop(stop[0], stop[1]); });
    return gradient;
  }

  // 地球儀とピンを描く。回っている間だけ呼ばれ、止まったら何も描かない
  function draw(now) {
    var size = canvas.clientWidth;
    if (!size) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.round(size * dpr);
    if (canvas.width !== px || canvas.height !== px) canvas.width = canvas.height = px;
    updateRotation(now);
    var radius = size * 0.46;
    var projection = d3.geoOrthographic().scale(radius).translate([size / 2, size / 2]).rotate(rotation);
    var front = [-rotation[0], -rotation[1]];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var path = d3.geoPath(projection, ctx);
    var ocean = gradientColors(
      ctx.createRadialGradient(size * 0.32, size * 0.27, 0, size / 2, size / 2, radius),
      [[0, '#1b3548'], [0.65, '#102332'], [1, '#0a1421']]
    );
    paint(path, sphere, ocean);
    paint(path, graticule, null, 'rgba(164, 203, 214, 0.12)', 0.5);
    countries.forEach(function(f) {
      paint(path, f, f.properties.visited ? '#4bbba5' : '#344c5c');
    });
    paint(path, borders, null, 'rgba(9, 25, 34, 0.42)', 0.6);
    ctx.fillStyle = '#4bbba5';
    islands.forEach(function(p) {
      if (d3.geoDistance(p, front) > Math.PI / 2) return;
      var xy = projection(p);
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2, 0, Math.PI * 2);
      ctx.fill();
    });
    // 光と縁のハイライトを球面の内側だけに重ねる。
    ctx.save();
    ctx.beginPath();
    path(sphere);
    ctx.clip();
    var shade = gradientColors(
      ctx.createLinearGradient(size * 0.16, size * 0.12, size * 0.87, size * 0.86),
      [[0, 'rgba(189, 232, 239, 0.16)'], [0.42, 'rgba(8, 18, 30, 0)'], [1, 'rgba(2, 8, 18, 0.72)']]
    );
    var limb = gradientColors(
      ctx.createRadialGradient(size / 2, size / 2, radius * 0.72, size / 2, size / 2, radius),
      [[0, 'rgba(124, 207, 220, 0)'], [0.92, 'rgba(124, 207, 220, 0.04)'], [1, 'rgba(124, 207, 220, 0.24)']]
    );
    paint(path, sphere, shade);
    paint(path, sphere, limb);
    ctx.restore();
    paint(path, sphere, null, 'rgba(167, 221, 229, 0.4)', 1);
    drawPin(projection, front);
  }

  function drawPin(projection, front) {
    // ピン: 撮影場所が分かる写真は塗った針、分からない写真は国の真ん中に輪だけ
    var visible = pin && d3.geoDistance(pin.lonLat, front) < Math.PI / 2;
    // 波紋は CSS のアニメーションで、止まっている間は canvas を描き直さない
    pulse.hidden = !visible || !!turn;
    if (!visible) return;
    var p = projection(pin.lonLat);
    pulse.style.left = canvas.offsetLeft + p[0] + 'px';
    pulse.style.top = canvas.offsetTop + p[1] + 'px';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0], p[1] - 16);
    ctx.strokeStyle = '#ffb454';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p[0], p[1] - 16, 4, 0, Math.PI * 2);
    ctx.fillStyle = pin.exact ? '#ffb454' : '#0f1522';
    ctx.fill();
    if (!pin.exact) ctx.stroke();
  }

  function loop(now) {
    draw(now);
    // 回り終わったら止める
    frame = turn ? requestAnimationFrame(loop) : 0;
  }

  // 写真の場所まで回す
  function show(photo) {
    load().then(function() {
      var lonLat = photo.geo ? [photo.geo[1], photo.geo[0]] : centers[photo.country];
      if (!lonLat) return;
      pin = { lonLat: lonLat, exact: !!photo.geo };
      countryLabel.textContent = photo.country;
      label.textContent = photo.geo ? formatGeo(photo.geo) : 'おおよその位置';
      // 遠回りしないように、経度は差が180°以内になる方へ回す
      var to = [-lonLat[0], Math.max(-60, Math.min(60, -lonLat[1]))];
      to[0] = rotation[0] + ((to[0] - rotation[0]) % 360 + 540) % 360 - 180;
      turn = { from: rotation.slice(), to: to, start: null };
      if (!frame) frame = requestAnimationFrame(loop);
    }, function() {});
  }

  // 画面サイズが変わったらピンと波紋の位置も更新する。
  window.addEventListener('resize', function() {
    if (graticule && !wrap.hidden && !frame) frame = requestAnimationFrame(loop);
  });
  return { show: show };
}

