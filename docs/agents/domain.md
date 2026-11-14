# Domain docs

この repository は一つの domain context として扱う。

- 仕様（今の振る舞いの正本）: `docs/spec.md`
- 使い心地の模型（正本ではない）: `docs/playground.html`
- 似た拡張と ComfyUI 本体の既存の働き: `docs/prior-art.md`
- Canonical glossary: root `CONTEXT.md`。今はないので、要るようになったら domain-modeling の流れで作る。候補の用語: 吸い付き（snap）、補助線（guide）、見た目の枠（visual bounds）、ぴったり付ける（abut）、列（column）、等間隔（distribute）、取っ手（handle）。
- Architecture decisions: `docs/adr/`。今はない。frontend に手を入れる場所（renderer ごとの hook）を決めたら、最初の ADR にする。

domain や architecture を変える前に、関連する仕様と ADR を読む。既存の ADR とぶつかる変更を黙って実装せず、ぶつかりを示して判断を求める。

domain documentation の承認は、承認された glossary か ADR の変更だけを許す。製品の実装、commit、push、Issue、PR は別の承認が要る。
