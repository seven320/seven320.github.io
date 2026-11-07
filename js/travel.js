(function() {
  // 写真の束(重ねてめくる見せ方は catnose.me を参考にした)
  // [-20.3048, -66.9325] -> 20.3048°S 66.9325°W
  function formatGeo(geo, approximate) {
    var lat = Math.abs(geo[0]).toFixed(4) + '°' + (geo[0] < 0 ? 'S' : 'N');
    var lon = Math.abs(geo[1]).toFixed(4) + '°' + (geo[1] < 0 ? 'W' : 'E');
    return lat + ' ' + lon + (approximate ? '（付近）' : '');
  }

  var pickPhoto = null;  // 地球儀の点が押されたら、その写真へ移る(写真の束を作った後で中身を入れる)
  var photoGlobe = window.createPhotoGlobe ? createPhotoGlobe(formatGeo, function(photo) { if (pickPhoto) pickPhoto(photo); }) : null;

  // 写真をめくると閲覧済みの写真が後ろに残る。近くで離すと戻る
  var openPhotoStack = (function() {
    var dialog = document.querySelector('.photo-stack');
    var stack = document.querySelector('.photo-stack-cards');
    var closeButton = document.querySelector('.photo-stack-close');
    var main = document.querySelector('.photo-stack-main');
    var position = document.querySelector('.photo-stack-position');
    var progress = document.querySelector('.photo-stack-progress > span');
    var announcement = document.querySelector('.photo-stack-announcement');
    var prevButton = dialog && dialog.querySelector('.photo-stack-prev');
    var nextButton = dialog && dialog.querySelector('.photo-stack-next');
    if (!dialog || !stack || !closeButton || !announcement || !dialog.showModal || !TRAVEL_PHOTOS.length) return null;
    var SENSITIVITY = 110;  // これより遠くまでドラッグしたらめくる(px)
    var TILT = 0.35;        // ドラッグしたときの傾き(1pxあたりの角度)
    // 写真を最初に表示したときからこの傾き・位置に置き、そのまま重ねる。
    var SCATTER = [[-1.4, -5, 4], [1.2, 5, -3], [-0.8, -3, -5], [1.6, 4, 5], [-1.2, 5, -4], [0.8, -5, 5]];
    var deck = [];
    var current = 0;
    var closing = null;
    var opener = null;
    var announceFrame = 0;

    function announce() {
      cancelAnimationFrame(announceFrame);
      announceFrame = requestAnimationFrame(function() {
        if (!dialog.open) return;
        var photo = deck[current].photo;
        announcement.textContent = '写真 ' + (cards.indexOf(deck[current]) + 1) + ' / ' + cards.length + '、' +
          photo.country + '、' + (photo.caption || '');
      });
    }

    function photoNumber(index) {
      return String(index).padStart(2, '0') + ' / ' + String(TRAVEL_PHOTOS.length).padStart(2, '0');
    }

    // 写真ごとにカードを1枚作っておく
    var cards = TRAVEL_PHOTOS.map(function(photo, i) {
      var card = document.createElement('div');
      card.className = 'photo-card';
      card.hidden = true;
      var s = SCATTER[i % SCATTER.length];
      card.innerHTML = '<figure class="shot"><div class="shot-image"><div class="shot-print"><img alt=""><span class="shot-corners"></span></div><span class="shot-date"></span></div>' +
        '<figcaption class="shot-meta"><div class="shot-copy"><span class="shot-caption"></span></div><span class="shot-index"></span></figcaption></figure>';
      var shot = card.firstChild;
      shot.style.setProperty('--rotate', s[0] + 'deg');
      shot.style.setProperty('--x', s[1] + 'px');
      shot.style.setProperty('--y', s[2] + 'px');
      var place = photo.place || photo.country;
      var image = card.querySelector('img');
      image.alt = photo.alt || (photo.caption ? photo.caption + '（' + place + '）' : place);
      if (photo.fit === 'contain') image.style.objectFit = 'contain';
      card.querySelector('.shot-index').textContent = photoNumber(i + 1);
      card.querySelector('.shot-caption').textContent = photo.caption || '';
      // 撮影日だけを写真に重ね、国名と緯度経度は地球儀に表示する。
      card.querySelector('.shot-date').textContent = photo.date ? photo.date.replace(/-/g, '.') : '';
      card.photo = photo;
      return card;
    });

    // 現在の写真と、それまでにめくった写真だけを表示する。
    // 閲覧済みのカードは位置を固定したまま、直前の写真ほど手前に積む。
    function layout() {
      deck.forEach(function(card, i) {
        card.style.zIndex = i + 1;
        card.classList.toggle('top', i === current);
        card.hidden = i > current;
        // 後ろの写真は見た目だけ残し、読み上げとフォーカスの対象から外す。
        card.inert = i !== current;
        // 次の写真は読み込みだけ先に済ませ、めくるまでは表示しない。
        if (i <= current + 1) {
          var img = card.querySelector('img');
          if (!img.getAttribute('src')) img.src = card.photo.src;
        }
      });
      prevButton.disabled = current === 0;
      nextButton.disabled = deck.length < 2;
      if (prevButton.disabled && document.activeElement === prevButton) nextButton.focus();
      var index = cards.indexOf(deck[current]) + 1;
      if (position) position.textContent = photoNumber(index);
      if (progress) progress.style.width = (index / cards.length * 100) + '%';
      if (photoGlobe) photoGlobe.show(deck[current].photo);
      announce();
    }

    function next() {
      if (deck.length < 2) return;
      // 一周したら、後ろを空にして最初の写真から見直す。
      current = (current + 1) % deck.length;
      layout();
    }

    function prev() {
      if (current === 0) return;
      current--;
      layout();
    }

    // 地球儀で選んだ写真まで一度にめくる(戻る方向なら、その写真まで戻す)。
    pickPhoto = function(photo) {
      var index = deck.findIndex(function(card) { return card.photo === photo; });
      if (index < 0 || index === current) return;
      current = index;
      layout();
    };

    prevButton.addEventListener('click', prev);
    nextButton.addEventListener('click', next);

    function open(country, trigger) {
      opener = trigger || document.activeElement;
      // 選んだ国から始め、その後も同じ順(日本から西回り)にたどる。
      var start = Math.max(0, cards.findIndex(function(c) { return c.photo.country === country; }));
      deck = cards.slice(start).concat(cards.slice(0, start));
      current = 0;
      drag = null;
      deck.forEach(function(card) {
        card.hidden = true;
        card.classList.remove('dragging');
        card.style.transform = '';
        stack.appendChild(card);
      });
      layout();
      clearTimeout(closing);
      dialog.classList.remove('closing');
      dialog.showModal();
      dialog.scrollTop = 0;
    }

    // 縮みながら消えてから閉じる
    function close() {
      if (!dialog.open || dialog.classList.contains('closing')) return;
      if (photoGlobe) photoGlobe.stop();
      dialog.classList.add('closing');
      closing = setTimeout(function() {
        dialog.classList.remove('closing');
        dialog.close();
      }, window.siteMotion.reduced ? 0 : 250);
    }

    // いちばん上の写真のドラッグ
    var drag = null;
    stack.addEventListener('pointerdown', function(e) {
      var card = e.target.closest('.photo-card');
      if (!card || card !== deck[current] || e.button !== 0) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
      drag = { card: card, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    });
    stack.addEventListener('pointermove', function(e) {
      if (!drag) return;
      drag.dx = e.clientX - drag.x;
      drag.dy = e.clientY - drag.y;
      // 引っぱった方向に、紙を持ち上げたように傾ける
      drag.card.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px) ' +
        'rotateX(' + (-drag.dy * TILT) + 'deg) rotateY(' + (drag.dx * TILT) + 'deg)';
    });
    function endDrag(e) {
      if (!drag) return;
      var card = drag.card;
      var moved = Math.max(Math.abs(drag.dx), Math.abs(drag.dy));
      drag = null;
      card.classList.remove('dragging');
      // ばねのように元の位置(めくったときは閲覧済みの束)に戻る
      card.style.transform = '';
      // 遠くまで動かしたか、ほとんど動かさずに離した(クリック)ときはめくる
      if (e.type !== 'pointercancel' && (moved > SENSITIVITY || moved < 4)) next();
    }
    stack.addEventListener('pointerup', endDrag);
    stack.addEventListener('pointercancel', endDrag);

    dialog.addEventListener('keydown', function(e) {
      // Tab は閉じるボタンから倍率・前後ボタンまでを一周させる。
      if (e.key === 'Tab') {
        var controls = Array.from(dialog.querySelectorAll('button:not(:disabled)'))
          .filter(function(el) { return el.getClientRects().length && !el.closest('[inert]'); });
        var first = controls[0];
        var last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });
    // Esc でもアニメーションしてから閉じる
    dialog.addEventListener('cancel', function(e) {
      e.preventDefault();
      close();
    });
    // dialog.close() が直接呼ばれた場合も停止する。
    dialog.addEventListener('close', function() {
      if (photoGlobe) photoGlobe.stop();
      cancelAnimationFrame(announceFrame);
      announcement.textContent = '';
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    });
    closeButton.addEventListener('click', close);
    // 写真の外を押したら閉じる
    dialog.addEventListener('click', function(e) {
      if (e.target === dialog || e.target === main) close();
    });

    // Travel カードの小さな写真(最後の2枚を見せる)
    var peek = document.querySelector('.photo-peek');
    if (peek) {
      var peekImages = peek.querySelectorAll('img');
      var last = TRAVEL_PHOTOS.length - 1;
      peek.hidden = false;
      // 画面の近くに来てから読む(loading="lazy" はかなり手前で読んでしまうので自前で見張る)
      new IntersectionObserver(function(entries, observer) {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        peekImages[0].src = TRAVEL_PHOTOS[Math.max(0, last - 1)].src;
        peekImages[1].src = TRAVEL_PHOTOS[last].src;
      }, { rootMargin: '200px' }).observe(peek);
      peek.addEventListener('click', function() { open(TRAVEL_PHOTOS[0].country, peek); });
    }

    return open;
  })();

  // 訪問した国・地域の名前を読み上げ用の一覧に入れる。写真は地図の国か Photos ボタンから開く。
  var countryList = document.querySelector('.travel-country-list');
  if (countryList && window.TRAVEL_COUNTRIES) {
    TRAVEL_COUNTRIES.forEach(function(country) {
      var item = document.createElement('li');
      item.lang = 'en';
      item.textContent = country;
      countryList.appendChild(item);
    });
  }

  // 世界地図の行った国を押すと、その国の写真の束を開く
  (function() {
    var wrap = document.querySelector('.travel-map-wrap');
    var img = document.querySelector('.travel-map');
    var label = document.querySelector('.travel-label');
    if (!wrap || !img || !label || !window.fetch) return;
    var hasPhoto = {};
    TRAVEL_PHOTOS.forEach(function(p) { hasPhoto[p.country] = true; });

    function show(name, trigger) {
      if (openPhotoStack && hasPhoto[name]) openPhotoStack(name, trigger);
    }

    // 選んでいる国を明るくして、国名を地図に重ねて出す
    var active = null;
    function activate(el) {
      if (el === active) return;
      if (active) active.classList.remove('active');
      active = el;
      if (!el) {
        label.classList.remove('show');
        wrap.style.cursor = '';
        return;
      }
      el.classList.add('active');
      wrap.style.cursor = el.classList.contains('has-photo') ? 'pointer' : '';
      var box = el.getBoundingClientRect();
      var base = wrap.getBoundingClientRect();
      label.textContent = el.dataset.name;
      label.style.left = (box.left + box.width / 2 - base.left) + 'px';
      label.style.top = (box.top - base.top) + 'px';
      label.classList.add('show');
    }

    // 地図が見えそうになってから読み込む(img の loading="lazy" と同じ考え)
    new IntersectionObserver(function(entries, observer) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      fetch(img.src).then(function(res) {
        return res.ok ? res.text() : Promise.reject(res.status);
      }).then(function(text) {
        var svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (svg.nodeName !== 'svg') return;
        svg.classList.add('travel-map');
        // role="img" のままだと中の国を押せることが読み上げで伝わらない
        svg.setAttribute('role', 'group');
        var visited = Array.prototype.slice.call(svg.querySelectorAll('.visited'));
        visited.forEach(function(el) {
          // 自前で国名を出すので、ブラウザの title のツールチップは消す
          var title = el.querySelector('title');
          el.dataset.name = title ? title.textContent : '';
          if (title) title.remove();
          if (openPhotoStack && hasPhoto[el.dataset.name]) {
            el.classList.add('has-photo');
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', el.dataset.name + 'の写真を見る');
          }
          // 閉じたときにフォーカスを戻しただけ(マウス操作の後)では、ハイライトを出さない。
          el.addEventListener('focus', function() { if (el.matches(':focus-visible')) activate(el); });
          el.addEventListener('blur', function() { activate(null); });
          el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              show(el.dataset.name, el);
            }
          });
        });

        // 小さい国は押しにくいので、国の上でなくても近くにある行った国を選ぶ
        var SNAP = 16;  // これより近ければ選ぶ(画面上のpx)
        var samples = null;
        // 国の輪郭の上に点を打っておき、一番近い点の国を探す
        function sample() {
          samples = [];
          visited.forEach(function(el) {
            if (el.nodeName === 'circle') {
              samples.push({ el: el, x: el.cx.baseVal.value, y: el.cy.baseVal.value });
              return;
            }
            var length = el.getTotalLength();
            var n = Math.max(8, Math.ceil(length / 3));
            for (var i = 0; i < n; i++) {
              var p = el.getPointAtLength(length * i / n);
              samples.push({ el: el, x: p.x, y: p.y });
            }
          });
        }

        function hit(e) {
          var direct = e.target.closest && e.target.closest('.visited');
          if (direct) return direct;
          if (!samples) sample();
          var ctm = svg.getScreenCTM();
          if (!ctm) return null;
          var point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
          var limit = SNAP / ctm.a;  // 画面のpxを地図の座標に直す
          var best = null;
          var bestDist = limit * limit;
          samples.forEach(function(s) {
            var d = (s.x - point.x) * (s.x - point.x) + (s.y - point.y) * (s.y - point.y);
            if (d < bestDist) {
              bestDist = d;
              best = s.el;
            }
          });
          return best;
        }

        svg.addEventListener('pointermove', function(e) { activate(hit(e)); });
        svg.addEventListener('pointerleave', function() { activate(null); });
        svg.addEventListener('click', function(e) {
          var el = hit(e);
          activate(el);
          if (el) show(el.dataset.name, el);
        });
        img.replaceWith(svg);
      }).catch(function() {});
    }, { rootMargin: '200px' }).observe(wrap);

  })();
})();
