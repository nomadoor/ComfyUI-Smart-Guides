# 似た拡張と ComfyUI 本体の既存の働き

2026-11-13 に調べた。ComfyUI frontend は 1.58.5（ComfyUI-dev で動いている版）。似た拡張はソースを読んで確かめた（README だけのものはそう書いた）。

## ComfyUI 本体にあるもの

| 働き | 場所 | この拡張との違い |
|---|---|---|
| 格子への吸い付き（Shift を押して離す、または常に） | 旧来: `LGraphCanvas._processDraggedItems`、Nodes 2.0: `useNodeDrag.endDrag` / `useNodeSnap` | 離したときに、選んだノードごとに `pos` を格子へ丸める。仕様の「離した後に動かさない」とぶつかる |
| Arrange（ツールバー） | `ArrangeButton.vue` / `useArrangeNodes.ts` | 一列か格子に詰め直す。間隔は 0〜48 のスライダー |
| Align Selected To（上・下・左・右） | ノードと canvas の右クリック、Nodes 2.0 の options menu（`useSelectionMenuOptions.ts`、`arrange.ts`） | 一番外のノードに揃える。中央揃えはない。`pos`/`size` で数え、見た目の枠ではない |
| Distribute Nodes（横・縦） | 同上 | 列を見ず、全部を一つの並びとして等間隔にする |

## 似た拡張

| 拡張 | 持っている働き | 手の入れ方 | 気を付ける所 |
|---|---|---|---|
| [ComfyUI-Block-Space](https://github.com/tywoodev/ComfyUI-Block-Space) | ドラッグとリサイズの吸い付き（端・中央・間隔）、点線の補助線、両方の表示、ツールバーのボタン | 旧来: `LGraphCanvas` の prototype を差し替え。Nodes 2.0: document の capture で `pointermove` の `clientX/Y` を書き換える | タイトルを 40px と決め打ち。Shift で吸い付きを切る |
| [ComfyUI-Majordomo](https://github.com/3ALLBUY14/ComfyUI-Majordomo) | 端の吸い付きと補助線、整列・大きさ・配置のパネル | window の `pointermove`（bubble）の後で直す。`drawFrontCanvas` を差し替えて描く。`graph.snapToGrid` を吸い付きの間だけ止める | 格子の止め方は旧来の表示でしか効かない |
| [ComfyUI-Pixaroma](https://github.com/pixaroma/ComfyUI-Pixaroma)（`js/align`） | ノードと group の端・中央への吸い付き、両方の表示でのリサイズの吸い付き、外れにくさ（hysteresis）、同じ線の補助線をまとめる | window の listener、`onDrawForeground`、Nodes 2.0 のリサイズは `[data-corner]` | Shift で吸い付きを切る |
| [ComfyUI-LVO-Node-Aligner](https://github.com/LVOcode/ComfyUI-LVO-Node-Aligner) | 決めた間隔での行・列、吸い付き、折りたたみ・固定ノードの扱い | 浮いたパネル。`beforeChange/afterChange` で undo 一回分 | 専用パネル（仕様では入れない形） |
| [ComfyUI-NodeAligner](https://github.com/Tenney95/ComfyUI-NodeAligner) | 揃え、等間隔、大きさ揃え、行・列（track）ごとの等間隔 | ツールバー、undo の transaction | 揃えで列ごとずれる不具合を直した記録がある |
| [komlevv-Align-ComfyUI](https://github.com/komlevv/komlevv-Align-ComfyUI)、[ComfyUI-NodeAlign](https://github.com/1038lab/ComfyUI-NodeAlign)、easykit-node-align（ComfyUI-dev に入っている） | 揃え、中央、等間隔、大きさ揃え | 自前のツールバーかパネル | easykit は手元に入っているので、確かめるときは外す |
| [ComfyUI-Align](https://github.com/Moooonet/ComfyUI-Align) | 揃え、等間隔、伸ばす | 中身は minify されていて読んでいない（README だけ） | — |

## どれも持っていないもの

- ワイヤが水平になる高さへの吸い付きと、水平になったワイヤ・スロットの強調（どの拡張の吸い付きの計算も、スロットの位置を使っていない）
- 列を見分けた横の等間隔と、等間隔の取っ手
- 「押しても何も起きない」「もうその状態」を理由つきで見せるボタン
- 標準のツールバーから開くメニュー

ドラッグ中に端へ吸い付いて補助線を出す部分は、Block-Space・Majordomo・Pixaroma と重なる。この拡張の芯は、ワイヤの水平と、列を見る等間隔の二つ。
