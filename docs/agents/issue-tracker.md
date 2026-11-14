# Issue tracker

GitHub Issues を、仕様と実装 ticket の正本にする。

- Repository: まだ作っていない（予定の名前は `nomadoor/ComfyUI-Smart-Guides`）。作るまでは、仕様は `docs/spec.md`、作業の状態は `AGENTS-STATE.md` に置く。
- Default branch: `main`（repository を作ったら確かめて直す）
- Issue、仕様、ticket の本文は日本語で書く。
- template の見出し、label、identifier、GitHub の keyword、canonical な用語は英語のまま。
- 仕様と ticket は、作る前に中身と公開について明示の承認を得る。
- ticket は親の仕様にリンクし、できれば GitHub の native dependency で blocking の関係を表す。
- 実装できる状態になった ticket にだけ `ready-for-agent` を付ける。
- 完了の PR は `Closes #N` で実装 ticket を閉じる。親の仕様は、全範囲が終わるまで閉じない。
- PR、Issue、comment には、同じ repository の中へのリンクだけを書く。frontend や似た拡張など外へのリンクは、repository の文書（`docs/prior-art.md` など）に書く。

Issue や comment を勝手に投稿しない。投稿にはオーナーの明示の承認が要る。
