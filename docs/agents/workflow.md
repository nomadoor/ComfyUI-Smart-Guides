# Engineering workflow

## Language

- Project prose language: Japanese

AI 向けの指示（`AGENTS.md`、`.claude/skills/`）は英語で書く。schema、identifier、template の見出し、tool の keyword、canonical な用語は英語のまま。Issue、commit message、PR、ADR、仕様書（`docs/spec.md`）など、人が読む文章は日本語で書く。英語はアメリカ式のつづりにする。

## Branch policy

- 承認された最初の repository の変更の直前に、作業ブランチを作る。
- default branch の上で、製品のファイルや workflow のファイルを変えない。
- Phase 1 で repository を変えないときは、`GO` の後、実装を始める前にブランチを作る。

## Prior art and specification

- 新しい働き・振る舞いの変更を仕様にする前、実装する前に、`prior-art` を当てる。対象は、この repository、ComfyUI frontend の動いている版のソース、似た拡張（`docs/prior-art.md`）。済んだ調べは使い回し、前提や範囲が変わる結果が出たら、仕様の話し合いに戻る。
- 新しい働きと振る舞いの変更には、仕様（`docs/spec.md` の該当の節）を先に直して承認を得る。
- はっきりした小さな bug fix、振る舞いを変えない refactor、文書、機械的な設定の変更は、仕様を省いてよい。
- 試し場（`docs/playground.html`）は使い心地を決める模型で、正本ではない。仕様と試し場がずれたら、仕様が正しい。

## Specification and tickets

- いくつもの session や agent にまたがる仕事、一つの context window に安全に収まらない仕事は、ticket に分ける。
- 仕様と ticket の公開は、それぞれ明示の承認を要る。
- domain doc の承認は、承認された glossary か ADR の変更だけを許す。

## Authorization

- `GO` は、実装、test、内部のレビュー、そのレビューで見つかった安全な直しを許す。
- `GO` は commit を許さない。
- commit は、diff、要件、test、レビューの指摘を含む commit packet を見せた後、明示の承認を要る。
- push と PR の作成は、commit とは別の承認を要る。PR は Draft を既定にする。
- Draft PR を ready にするのは、CI が通り、オーナーが承認した後。
- merge、版上げ、タグ、リリースはオーナーが行う。

## Implementation and review

- 新しい振る舞いと bug fix は TDD で作る。test の継ぎ目は、DOM と ComfyUI を import しない純粋な module（吸い付きの計算、列の見分け、整列・等間隔の計算）。
- 文書、comment、振る舞いを変えない機械的な変更、生成物、外の設定は、理由を記録して例外にしてよい。
- 緊急の直しは実装を先にしてよいが、すぐ後に regression test を足す。
- ブラウザでの振る舞いは、本物の ComfyUI で、旧来の表示と Nodes 2.0 の両方で確かめる（`.claude/skills/browser-check/`）。
- commit の前に、commit していない作業ツリー全体を、Standards、承認済みの仕様、ticket、関連する domain doc と照らす。
- 振る舞いを変える commit には、実装した session とは別の、読むだけの AI レビューを要る。
- 別のレビューには、要件の出どころ、仕様と ticket、関連する domain doc、diff、確かめた結果を渡す。実装側の見立ては渡さない。
- 指摘は P0 / P1 / P2 / P3 に分ける。P0 と P1 は commit を止める。
- P0 か P1 を直した後は、もう一度レビューする。
- CodeRabbit は自動で走らせない（`.coderabbit.yaml`）。大きな変更、新しい仕組み、前のレビューが迷ったときだけ、PR に一度 `@coderabbitai review` を頼む。
