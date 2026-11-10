# seven320.github.io

データエンジニア 電電 (denden) のプロフィールページです。

**https://seven320.github.io/**

## 内容

| セクション | 内容 |
| --- | --- |
| About | 自己紹介、技術・言語・資格、行った国の世界地図 |
| Career | 職歴と学歴 |
| Competitions | Kaggle・SIGNATE のメダル獲得コンペ |
| Products | 個人で作ったもの（ほめたもん、自動起き上がりターゲット、誰でもARCard） |

## 構成

ビルドの仕組みは使っていない、HTML・CSS・JavaScript だけの静的サイトです。`master` ブランチがそのまま GitHub Pages で公開されます。

```
.
├── index.html                 # ページ本体（ヒーローの水面エフェクトの JS もここ）
├── 404.html                   # 存在しない URL を開いたときのページ
├── css/stylesheet.css         # スタイル
├── js/motion.js               # 端末の「視差効果を減らす」設定を JS のアニメーションで共有
├── js/photo-globe.js          # 写真に連動する地球儀（formatGeo と、点を押したときの onPick を受け取るファクトリ）
├── js/travel-countries.js     # 訪問した国・地域の一覧（読み上げ用。自動生成）
├── js/travel-photos.js        # 写真・場所・説明文・日付・表示方法の一覧
├── js/travel.js               # 写真の切り替えと世界地図の操作
├── fonts/                     # Web フォント（Inter, JetBrains Mono のラテン文字部分を自前で配信）
├── images/                    # アイコン・作品画像・世界地図
├── scripts/build_world_map.py # 世界地図 (images/world-map.svg) と写真の地球儀の国の形 (images/globe.json) の生成スクリプト
├── scripts/build_og_image.py  # SNS でシェアしたときのカード画像 (images/og-image.jpg) の生成スクリプト
└── .github/workflows/check.yml # HTML の検証とリンク切れチェック
```

- **水面エフェクト**: ヒーロー部分の背景は canvas に描いています。毎秒の時刻を SHA-256 でハッシュ化した値で水滴を落とし、波動方程式で波紋を広げています。画面外にあるときやタブが裏にあるとき、`prefers-reduced-motion` が有効なときは止まります。
- **SNS・検索**: シェアしたときは横長のカード画像 (`images/og-image.jpg`) を表示します。アイコンや肩書きを変えたら `uv run scripts/build_og_image.py` で作り直します（macOS のヒラギノ角ゴシックを使います）。検索エンジン向けに、名前と各 SNS のリンクを JSON-LD (schema.org の Person) で書き、正規の URL を `rel="canonical"` で示しています。
- **表示速度**: フォントは自前で配信してプリロードし、Google Analytics (GA4) はページの読み込みが終わってから遅らせて読み込んでいます。

## 手元で確認する

```sh
python3 -m http.server 8000
```

ブラウザで http://localhost:8000/ を開きます。

地球儀と世界地図はデータを `fetch` で読むので、`index.html` を直接開かずにローカルサーバー経由で確認してください。地球儀の描画に使う d3-geo・d3-array・topojson-client だけは、はじめて写真を開いたときに jsDelivr から読み込みます（ネットにつながっていないと地球儀は出ません）。版を固定し、`integrity` (SRI) で中身を確かめているので、版を上げるときは `js/photo-globe.js` の `LIBS` の `integrity` も作り直します。

## チェック

push・プルリクエストのたびと毎週月曜に、GitHub Actions で次を確認しています。

- [html-validate](https://html-validate.org/) で HTML を検証（設定は `.htmlvalidate.json`）
- [lychee](https://github.com/lycheeverse/lychee) でリンク切れを確認（X・Instagram はボットを弾くので対象外）

手元で HTML を検証するときは次を実行します。

```sh
npx html-validate@9 index.html 404.html
```

## 世界地図を更新する

`scripts/build_world_map.py` の `VISITED` に [world-atlas](https://github.com/topojson/world-atlas) の国名（英語）を足して、スクリプトを実行し直します。

```sh
curl -sL -o /tmp/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
curl -sL -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
uv run scripts/build_world_map.py /tmp/countries-110m.json /tmp/countries-50m.json
```

平らな地図 (`images/world-map.svg`) は粗い 110m、写真の横の地球儀 (`images/globe.json`) は小さな島まで載っている 50m から作ります。

国の数は `index.html` の `travel-count` に手で書いているので、あわせて更新してください。

## 旅行の写真を足す

世界地図で行った国を押すと、その国の写真から開きます。開いた直後は1枚だけを表示し、めくった写真だけが後ろに重なります。各写真の傾きと位置は最初の表示時から固定し、後ろに回っても動かしません。キャプション・撮影日・枚数は傾けず、水平に表示します。前に戻ると重なりも戻り、開き直したときや一周したときは後ろを空にします。

写真は `images/travel/` に置き、`js/travel-photos.js` の `TRAVEL_PHOTOS` に1行足します。表示順は日本から西へ回る順（`geo` の経度順）で、同じ場所では登録順を保ちます。`geo` のない写真は最後に並びます。地図から開く場合も選んだ国から同じ順に進み、末尾から先頭へ続きます。写真にはキャプション・撮影日・枚数を表示し、国名と緯度経度は地球儀にまとめています。

写真はクリック・スワイプ・左右キーに加え、画面下の矢印ボタンでも切り替えられます。写真番号とバーで、表示中の写真の位置を確認できます。開いている写真に合わせて URL が `#photo=peru-2`（ファイル名から拡張子を除いたもの）に変わるので、そのまま共有できます。この URL を開くと、その写真からビューアが開きます。

写真の横の地球儀は「1× / 2× / 4×」のボタンで倍率を切り替えられ、ホイールや2本指のピンチでも1〜4倍の間で拡大・縮小できます。拡大すると円が枠いっぱいに広がり、縁だけが背景に溶けるように薄くなります。ドラッグで回すこともできます。写真をめくっても倍率は維持し、次の撮影場所を中心に表示します。

地球儀は About の世界地図と同じ配色で、訪問した国を青緑、その他の国を紺色のベタ塗りで表示し、国境を暗い線で区切ります。表示中の写真の撮影場所はオレンジのピン、ほかの写真の撮影場所は小さなオレンジの点で示し、点を押すとその場所の1枚目の写真へ移ります。

```js
{ country: 'Peru', src: 'images/travel/peru-1.webp', caption: 'マチュピチュの朝' },
```

- 国名は `scripts/build_world_map.py` の `VISITED` と同じ英語名にします
- `alt` には写真に写っている内容を書きます（スクリーンリーダーで読み上げる説明）。省略すると `caption` と地域名から作ります
- 地域名は `place`（例: `'Hawaii'`）で画像の代替テキストに補足できます。並び順・地球儀の国名・世界地図との対応には `country` を使います
- `fit: 'contain'` を指定すると、写真を切り抜かず全体を表示します（未指定なら枠いっぱいに表示）
- `geo: [緯度, 経度]` で地球儀の位置を指定できます。手動で補った代表座標には `geoApproximate: true` を付けると「付近」と表示します
- 置く前に、写真の向きを直してから撮影場所の GPS などの EXIF を消します（スマホの写真には位置情報が入っていることが多いです）
- 長い辺を 1200px くらいに縮めて、WebP か JPEG にします。iPhone の HEIC は Safari 以外で表示できないので変換します
- ファイル名は `peru-1.webp` のように英小文字にします

## クレジット

- アイコン: [Font Awesome Free 5.5.0](https://fontawesome.com/license/free) (CC BY 4.0)
- フォント: [Inter](https://github.com/rsms/inter), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (SIL Open Font License 1.1)
- 地図データ: [world-atlas](https://github.com/topojson/world-atlas)（[Natural Earth](https://www.naturalearthdata.com/) を元にしたもの）
- 地球儀の描画: [d3-geo](https://github.com/d3/d3-geo), [d3-array](https://github.com/d3/d3-array), [topojson-client](https://github.com/topojson/topojson-client) (ISC License)

## Author

[seven320](https://github.com/seven320)

<a href="https://github.com/stats-organization/github-stats-extended">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github-stats-extended.vercel.app/api?username=seven320&show_icons=true&theme=dark_github" />
    <img src="https://github-stats-extended.vercel.app/api?username=seven320&show_icons=true&theme=light_github" alt="seven320's GitHub stats" />
  </picture>
</a>
<a href="https://github.com/stats-organization/github-stats-extended">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github-stats-extended.vercel.app/api/top-langs/?username=seven320&layout=compact&theme=dark_github" />
    <img src="https://github-stats-extended.vercel.app/api/top-langs/?username=seven320&layout=compact&theme=light_github" alt="seven320's top languages" />
  </picture>
</a>
