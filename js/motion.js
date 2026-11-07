// 端末の「視差効果を減らす」設定を、canvas や JS のアニメーションでも共有する。
// CSS のアニメーションは stylesheet.css の prefers-reduced-motion で止める。
(function() {
  var media = window.matchMedia('(prefers-reduced-motion: reduce)');
  var listeners = [];

  window.siteMotion = {
    reduced: media.matches,
    subscribe: function(listener) { listeners.push(listener); }
  };

  media.addEventListener('change', function() {
    siteMotion.reduced = media.matches;
    listeners.forEach(function(listener) { listener(siteMotion.reduced); });
  });
})();
