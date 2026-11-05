// 旅行の写真。国名は world-atlas の英語名(scripts/build_world_map.py の VISITED と同じ)。写真は images/travel/ に置く
// 並びは写真の束の上からの順番
var TRAVEL_PHOTOS = [
  // チュクンリ山は本人の場所指定から補った代表座標: https://www.sherpana.com/locations/chukhung-ri
  { country: 'Nepal', src: 'images/travel/nepal-1.webp', caption: 'チュクンリ山', geo: [27.9256, 86.8790], geoApproximate: true },
  { country: 'China', place: 'Hong Kong', src: 'images/travel/hongkong-1.webp', caption: 'ビクトリアハーバーの夜景', geo: [22.2774, 114.1482], date: '2025-03-30' },
  { country: 'United States of America', place: 'Hawaii', src: 'images/travel/hawaii-1.webp', caption: 'ハワイの夕暮れ', geo: [21.2809, -157.8376], date: '2026-06-25' },
  { country: 'Indonesia', place: 'Bali', src: 'images/travel/bali-1.webp', caption: 'バリ島の寺院と山並み', geo: [-8.3916, 115.6312], date: '2024-01-24', fit: 'contain' },
  { country: 'India', place: 'Ladakh', src: 'images/travel/ladakh-1.webp', caption: 'レーの寺院', geo: [34.1645, 77.5851], date: '2023-08-07' },
  { country: 'India', place: 'Ladakh', src: 'images/travel/ladakh-2.webp', caption: '青空にはためく祈祷旗', geo: [34.1642, 77.5849], date: '2023-08-08' },
  { country: 'Antarctica', src: 'images/travel/antarctica-1.webp', caption: '', date: '2025-01-01' },
  { country: 'Jordan', src: 'images/travel/jordan-1.webp', caption: 'ペトラ遺跡の野良猫' },
  { country: 'Bolivia', src: 'images/travel/bolivia-1.webp', caption: 'ウユニ塩湖の鏡張り', geo: [-20.3048, -66.9325], date: '2017-03-24' },
  { country: 'Bolivia', src: 'images/travel/bolivia-2.webp', caption: 'ウユニ塩湖の夕日', date: '2017-03-24', fit: 'contain' },
  { country: 'Cuba', src: 'images/travel/cuba-1.webp', caption: 'ハバナのクラシックカー', geo: [23.1337, -82.3584], date: '2017-01-13' },
  { country: 'Ecuador', src: 'images/travel/ecuador-1.webp', caption: 'アシカと遊ぶ', geo: [-0.9622, -90.9572], date: '2017-02-12' },
  { country: 'Mongolia', src: 'images/travel/mongolia-1.webp', caption: '駅で列車を待つ', date: '2017-09-17' },
  { country: 'Mongolia', src: 'images/travel/mongolia-2.webp', caption: '草原のラクダ', geo: [47.331, 103.691], date: '2017-09-19' },
  { country: 'Peru', src: 'images/travel/peru-1.webp', caption: 'アンデスの谷', geo: [-8.9392, -77.6833], date: '2017-02-24' },
  { country: 'Peru', src: 'images/travel/peru-2.webp', caption: '山で出会った犬たち', date: '2017-02-24' }
];
