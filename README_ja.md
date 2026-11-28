# ComfyUI Smart Guides

[![English](https://img.shields.io/badge/lang-English-blue)](README.md)
[![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-red)](README_ja.md)

ComfyUI のキャンバスで、ノードをきれいに並べるための拡張です。旧来の表示と Nodes 2.0 の両方で使えます。

## インストール

ComfyUI Manager で「Smart Guides」を検索してインストールしてください。

## スマートガイド

https://github.com/user-attachments/assets/a5a9083c-f81f-4f38-9ab7-d7f8246ff848

ノードやグループをドラッグ・リサイズすると、次の位置に吸い付きます。

- ワイヤが水平になる位置
- ほかのノードやグループの端
- ぴったり隣り合う位置

揃った端には補助線が出ます。Shift を押しながら動かすと吸い付きません。

## 整列と等間隔

https://github.com/user-attachments/assets/2e4ee913-2235-46dc-9384-d48deccdb8ff

ノードを 2 つ以上選び、選択ツールボックスの整列ボタンを押すとメニューが開きます。

- 左・中央・右、上・中央・下で揃える
- 幅・高さを揃える
- 横・縦に等間隔に並べる

等間隔にしたあとは、すき間に取っ手が出ます。ドラッグすると全部の間隔が一緒に変わります。

> [!NOTE]
> ComfyUI の設定で「選択ツールボックスを表示」をオフにしているときは、整列ボタンは Run の横に出ます。

## グループのリサイズ

https://github.com/user-attachments/assets/e2b46283-742c-4c03-b99a-cfa1206984fe

グループを四隅のどこからでもリサイズできます。

## 設定

ComfyUI の ⚙ `Settings` → `Smart Guides` タブで、次の項目を設定できます。

- ドラッグとリサイズで吸い付く
- ワイヤが水平になる位置に吸い付く
- ほかのノードやグループの端に吸い付く
- 吸い付く距離（画面の px）
- 端に吸い付く相手を、どこまで離れたものにするか（キャンバス単位、0 は制限なし）
- 補助線の色（テーマの強調の色か、選んだ色）

## ライセンス

MIT
