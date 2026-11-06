// 旅行の写真。国名は world-atlas の英語名(scripts/build_world_map.py の VISITED と同じ)。写真は images/travel/ に置く
// alt は見える内容の説明、caption は画面に出す一言。
// 表示は国名の A→Z。同じ国の写真は登録順を保つ。
var TRAVEL_PHOTOS = [
  // チュクンリ山は本人の場所指定から補った代表座標: https://www.sherpana.com/locations/chukhung-ri
  { country: 'Nepal', src: 'images/travel/nepal-1.webp', alt: 'チュクンリ山から望む雪山の連なり。谷を白い雲が覆い、手前には岩の斜面が広がる。', caption: 'チュクンリ山', geo: [27.9256, 86.8790], geoApproximate: true },
  { country: 'China', place: 'Hong Kong', src: 'images/travel/hongkong-1.webp', alt: '高台から見下ろす香港の夜景。ビクトリアハーバーを挟んで高層ビルの明かりが広がる。', caption: 'ビクトリアハーバーの夜景', geo: [22.2774, 114.1482], date: '2025-03-30' },
  { country: 'United States of America', place: 'Hawaii', src: 'images/travel/hawaii-1.webp', alt: '夕暮れのハワイの浜辺。オレンジ色の水平線にヤシの木が並び、波打ち際に人々がいる。', caption: 'ハワイの夕暮れ', geo: [21.2809, -157.8376], date: '2026-06-25' },
  { country: 'Indonesia', place: 'Bali', src: 'images/travel/bali-1.webp', alt: 'バリ島の寺院を見下ろす石像。奥には境内と、雲のかかった山が見える。', caption: 'バリ島の寺院と山並み', geo: [-8.3916, 115.6312], date: '2024-01-24', fit: 'contain' },
  { country: 'India', place: 'Ladakh', src: 'images/travel/ladakh-1.webp', alt: 'レーの寺院の中庭。金色の屋根を持つ建物の上に、色とりどりの祈祷旗が渡されている。', caption: 'レーの寺院', geo: [34.1645, 77.5851], date: '2023-08-07' },
  { country: 'India', place: 'Ladakh', src: 'images/travel/ladakh-2.webp', alt: '白い雲が浮かぶ青空を背景に、赤・青・黄・緑・白の祈祷旗が何列もはためく。', caption: '青空にはためく祈祷旗', geo: [34.1642, 77.5849], date: '2023-08-08' },
  // 本人指定のパラダイス湾付近。SCAR掲載の代表座標: https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=110496
  { country: 'Antarctica', src: 'images/travel/antarctica-1.webp', alt: '南極の雪の上を歩くペンギン。背後の湾には客船と氷山があり、雪山が連なる。', caption: 'パラダイス湾のペンギン', geo: [-64.85, -62.9], geoApproximate: true, date: '2025-01-01' },
  // 本人の場所指定から補ったエル・ハズネ前の代表座標: https://mapcarta.com/W488848937
  { country: 'Jordan', src: 'images/travel/jordan-1.webp', alt: 'ペトラ遺跡の柱と赤い岩壁を背に、毛の長い猫が横を向いている。', caption: 'ペトラ遺跡の野良猫', geo: [30.3221, 35.4515], geoApproximate: true },
  { country: 'Bolivia', src: 'images/travel/bolivia-1.webp', alt: 'ウユニ塩湖の浅い水面に並ぶ色とりどりの椅子。青空と白い雲が鏡のように映り込む。', caption: 'ウユニ塩湖の鏡張り', geo: [-20.3048, -66.9325], date: '2017-03-24' },
  // 本人確認で鏡張りの写真と同じ場所。そちらの撮影座標を目安にする。
  { country: 'Bolivia', src: 'images/travel/bolivia-2.webp', alt: 'オレンジ色の夕日の前で椅子に座る人のシルエット。太陽と人影がウユニ塩湖の水面に映る。', caption: 'ウユニ塩湖の夕日', geo: [-20.3048, -66.9325], geoApproximate: true, date: '2017-03-24', fit: 'contain' },
  { country: 'Cuba', src: 'images/travel/cuba-1.webp', alt: 'ハバナの通りを走る青いクラシックカー。後方にドームのある建物とヤシの木が並ぶ。', caption: 'ハバナのクラシックカー', geo: [23.1337, -82.3584], date: '2017-01-13' },
  { country: 'Ecuador', src: 'images/travel/ecuador-1.webp', alt: '木の桟橋に座るアシカと、そのそばにかがんで顔を近づける人。周囲にサンダルや荷物がある。', caption: 'アシカと遊ぶ', geo: [-0.9622, -90.9572], date: '2017-02-12' },
  // 本人指定のザミンウード駅付近の座標。
  { country: 'Mongolia', src: 'images/travel/mongolia-1.webp', alt: '駅のホームに停まる緑色の長い列車。手前のホームにスーツケースなどの荷物が置かれている。', caption: '駅で列車を待つ', geo: [43.719460, 111.906627], geoApproximate: true, date: '2017-09-17' },
  { country: 'Mongolia', src: 'images/travel/mongolia-2.webp', alt: '広い草原に立つラクダ。遠くに白いゲルと低い山並みが見える。', caption: '草原のラクダ', geo: [47.331, 103.691], date: '2017-09-19' },
  { country: 'Peru', src: 'images/travel/peru-1.webp', alt: '両側を急な山に挟まれたアンデスの谷。乾いた地面の手前に動物の頭骨と骨が横たわる。', caption: 'アンデスの谷', geo: [-8.9392, -77.6833], date: '2017-02-24' },
  // 本人確認で谷の写真の先。移動方向・距離は不明なので、谷の座標を周辺の目安にする。
  { country: 'Peru', src: 'images/travel/peru-2.webp', alt: '岩の散らばる草地で休む3匹の犬。手前には登山用の荷物と水のボトルが置かれている。', caption: '山で出会った犬たち', geo: [-8.9392, -77.6833], geoApproximate: true, date: '2017-02-24' }
];

TRAVEL_PHOTOS.sort(function(a, b) {
  return a.country.localeCompare(b.country, 'en');
});
