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
├── css/stylesheet.css         # スタイル
├── fonts/                     # Web フォント（Inter, JetBrains Mono のラテン文字部分を自前で配信）
├── images/                    # アイコン・作品画像・世界地図
└── scripts/build_world_map.py # 世界地図 (images/world-map.svg) の生成スクリプト
```

- **水面エフェクト**: ヒーロー部分の背景は canvas に描いています。毎秒の時刻を SHA-256 でハッシュ化した値で水滴を落とし、波動方程式で波紋を広げています。画面外にあるときやタブが裏にあるとき、`prefers-reduced-motion` が有効なときは止まります。
- **表示速度**: フォントは自前で配信してプリロードし、Google Analytics (GA4) はページの読み込みが終わってから遅らせて読み込んでいます。

## 手元で確認する

```sh
python3 -m http.server 8000
```

ブラウザで http://localhost:8000/ を開きます。

## 世界地図を更新する

`scripts/build_world_map.py` の `VISITED` に [world-atlas](https://github.com/topojson/world-atlas) の国名（英語）を足して、スクリプトを実行し直します。

```sh
curl -sL -o /tmp/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
python3 scripts/build_world_map.py /tmp/countries-110m.json
```

国の数は `index.html` の `travel-count` に手で書いているので、あわせて更新してください。

## クレジット

- アイコン: [Font Awesome Free 5.5.0](https://fontawesome.com/license/free) (CC BY 4.0)
- フォント: [Inter](https://github.com/rsms/inter), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (SIL Open Font License 1.1)
- 地図データ: [world-atlas](https://github.com/topojson/world-atlas)（[Natural Earth](https://www.naturalearthdata.com/) を元にしたもの）

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
