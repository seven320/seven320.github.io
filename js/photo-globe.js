// 写真の束の横の地球儀。いちばん上の写真を撮った場所まで回してピンを刺す
// 地図のライブラリと国の形は、はじめて写真を開いたときに読み込む
function createPhotoGlobe(formatGeo) {
  var wrap = document.querySelector('.photo-globe-wrap');
  var canvas = document.querySelector('.photo-globe');
  var label = document.querySelector('.photo-globe-label');
  var countryLabel = document.querySelector('.photo-globe-country');
  var pulse = document.querySelector('.photo-globe-pulse');
  var zoomIn = document.querySelector('.photo-globe-zoom-in');
  var zoomOut = document.querySelector('.photo-globe-zoom-out');
  var zoomReset = document.querySelector('.photo-globe-zoom-reset');
  if (!wrap || !canvas || !pulse || !canvas.getContext || !window.fetch) return null;
  var LIBS = [
    'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
    'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
    'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'
  ];
  var TURN = 900;  // 次の場所まで回る時間(ms)
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 6;
  var zoom = 1;
  var touches = new Map();
  var pinch = null;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ready = null;
  var countries = [];
  var currentCountry = null;
  var islands = [];
  var centers = {};
  var graticule = null;
  var borders = null;
  var rotation = [-140, -20];
  var turn = null;   // { from, to, start }
  var pin = null;    // { lonLat, exact }
  var frame = 0;
  var active = false;
  var revision = 0;
  var ctx = canvas.getContext('2d');
  if (!ctx) return null;
  var sphere = { type: 'Sphere' };
  var terrain = typeof createGlobeTerrain === 'function' ? createGlobeTerrain(requestDraw) : null;

  function requestDraw() {
    if (active && graticule && !wrap.hidden && !frame) frame = requestAnimationFrame(loop);
  }

  function setZoom(value) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    if (zoomIn) zoomIn.disabled = zoom >= MAX_ZOOM;
    if (zoomOut) zoomOut.disabled = zoom <= MIN_ZOOM;
    if (zoomReset) {
      zoomReset.textContent = zoom.toFixed(1) + '×';
      zoomReset.setAttribute('aria-label', '現在' + zoom.toFixed(1) + '倍。1倍に戻す');
    }
    requestDraw();
  }

  if (zoomIn) zoomIn.addEventListener('click', function() { setZoom(zoom * 1.5); });
  if (zoomOut) zoomOut.addEventListener('click', function() { setZoom(zoom / 1.5); });
  if (zoomReset) zoomReset.addEventListener('click', function() { setZoom(1); });

  canvas.addEventListener('wheel', function(e) {
    if (!active || !graticule) return;
    e.preventDefault();
    var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    var delta = Math.max(-120, Math.min(120, e.deltaY * unit));
    setZoom(zoom * Math.exp(-delta * 0.003));
  }, { passive: false });

  function touchDistance() {
    var points = Array.from(touches.values());
    return Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]);
  }

  canvas.addEventListener('pointerdown', function(e) {
    if (e.pointerType !== 'touch' || !active || !graticule) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
    pinch = touches.size === 2 ? { distance: touchDistance(), zoom: zoom } : null;
  });
  canvas.addEventListener('pointermove', function(e) {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pinch.distance > 0) setZoom(pinch.zoom * touchDistance() / pinch.distance);
  });
  function endTouch(e) {
    touches.delete(e.pointerId);
    pinch = touches.size === 2 ? { distance: touchDistance(), zoom: zoom } : null;
  }
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  canvas.addEventListener('lostpointercapture', endTouch);

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
    // d3-geo は d3-array を使うので順番に読む
    ready = LIBS.reduce(function(chain, src) {
      return chain.then(function() {
        // 成功済みのライブラリは再読み込みしない。
        var loaded = [window.d3 && window.d3.extent, window.d3 && window.d3.geoPath, window.topojson && window.topojson.feature];
        if (!loaded[LIBS.indexOf(src)]) return loadScript(src);
      });
    }, Promise.resolve()).then(function() {
      // file:// ではローカル JSON を fetch できないため、同じデータの JS 版を読む。
      if (location.protocol === 'file:') {
        if (window.PHOTO_GLOBE_DATA) return window.PHOTO_GLOBE_DATA;
        return loadScript('js/globe-data.js').then(function() { return window.PHOTO_GLOBE_DATA; });
      }
      return fetch('images/globe.json').then(function(res) {
        return res.ok ? res.json() : Promise.reject(res.status);
      });
    }).then(function(topo) {
      islands = [];
      centers = {};
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
    });
    // 失敗したPromiseを保持せず、次に写真を開いたときに再試行する。
    ready = ready.catch(function(error) {
      ready = null;
      wrap.hidden = true;
      throw error;
    });
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

  // 地球儀とピンを描く。回転中とズーム・サイズ変更時だけ描き直す
  function draw(now) {
    var size = canvas.clientWidth;
    if (!size) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.round(size * dpr);
    if (canvas.width !== px || canvas.height !== px) canvas.width = canvas.height = px;
    updateRotation(now);
    var radius = size * 0.46;
    var projection = d3.geoOrthographic().scale(radius * zoom).translate([size / 2, size / 2]).rotate(rotation);
    var front = [-rotation[0], -rotation[1]];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // 表示枠は固定し、撮影場所を中心に地図だけを拡大する。
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.clip();
    var path = d3.geoPath(projection, ctx);
    var ocean = gradientColors(
      ctx.createRadialGradient(size * 0.32, size * 0.27, 0, size / 2, size / 2, radius),
      [[0, '#193749'], [0.65, '#0c202e'], [1, '#080f1b']]
    );
    paint(path, sphere, ocean);
    paint(path, graticule, null, 'rgba(164, 203, 214, 0.14)', 0.5);
    var visitedLand = gradientColors(
      ctx.createLinearGradient(0, 0, size, size),
      [[0, '#8dcfbb'], [0.5, '#49a994'], [1, '#24545b']]
    );
    countries.forEach(function(f) {
      paint(path, f, f.properties.visited ? visitedLand : '#2b4352');
    });
    var relief = terrain && terrain.draw(px, rotation, zoom);
    if (relief) {
      // 元の国の色を保ち、標高に応じた濃淡だけを陸地に重ねる。
      ctx.save();
      ctx.beginPath();
      countries.forEach(function(f) { path(f); });
      ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(relief, 0, 0, size, size);
      ctx.restore();
    }
    paint(path, borders, null, 'rgba(8, 25, 30, 0.48)', 0.6);
    // 写真を見ている国の輪郭を、淡い線で浮かび上がらせる。
    countries.forEach(function(f) {
      if (f.properties.name === currentCountry && f.properties.visited) {
        paint(path, f, null, 'rgba(203, 255, 233, 0.7)', 1);
      }
    });
    ctx.fillStyle = '#69bba5';
    islands.forEach(function(p) {
      if (d3.geoDistance(p, front) > Math.PI / 2) return;
      var xy = projection(p);
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2, 0, Math.PI * 2);
      ctx.fill();
    });
    // 控えめな陰影だけで球面の丸みを出す。
    var shade = gradientColors(
      ctx.createLinearGradient(size * 0.16, size * 0.12, size * 0.87, size * 0.86),
      [[0, 'rgba(189, 232, 239, 0.16)'], [0.42, 'rgba(8, 18, 30, 0)'], [1, 'rgba(2, 8, 18, 0.72)']]
    );
    paint(path, sphere, shade);
    drawPin(projection, front, size, radius);
    ctx.restore();
  }

  function drawPin(projection, front, size, radius) {
    // ピン: 撮影場所が分かる写真は塗った針、分からない写真は国の真ん中に輪だけ
    var p = pin && projection(pin.lonLat);
    var visible = pin && d3.geoDistance(pin.lonLat, front) < Math.PI / 2 &&
      Math.hypot(p[0] - size / 2, p[1] - size / 2) < radius;
    // 波紋は CSS のアニメーションで、止まっている間は canvas を描き直さない
    pulse.hidden = !visible || !!turn;
    if (!visible) return;
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
    active = true;
    if (terrain) terrain.load();
    var request = ++revision;
    load().then(function() {
      // 閉じた後や、次の写真へ移った後の読み込み結果は使わない。
      if (!active || request !== revision) return;
      wrap.hidden = false;
      var lonLat = photo.geo ? [photo.geo[1], photo.geo[0]] : centers[photo.country];
      if (!lonLat) return;
      pin = { lonLat: lonLat, exact: !!photo.geo && !photo.geoApproximate };
      currentCountry = photo.country;
      countryLabel.textContent = photo.country === 'United States of America' ? 'United States' : photo.country;
      label.textContent = photo.geo ? formatGeo(photo.geo, photo.geoApproximate) : 'おおよその位置';
      // 遠回りしないように、経度は差が180°以内になる方へ回す
      // 南極など高緯度の場所も、拡大したときにピンが中央に残るよう真ん中に向ける。
      var to = [-lonLat[0], -lonLat[1]];
      to[0] = rotation[0] + ((to[0] - rotation[0]) % 360 + 540) % 360 - 180;
      turn = { from: rotation.slice(), to: to, start: null };
      if (!frame) frame = requestAnimationFrame(loop);
    }, function() {});
  }

  function stop() {
    active = false;
    revision++;
    cancelAnimationFrame(frame);
    frame = 0;
    turn = null;
    touches.clear();
    pinch = null;
    pulse.hidden = true;
    wrap.hidden = true;
  }

  // 画面サイズが変わったらピンと波紋の位置も更新する。
  window.addEventListener('resize', requestDraw);
  return { show: show, stop: stop };
}

