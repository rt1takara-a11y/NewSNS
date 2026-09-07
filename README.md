# NewSNS（仮）

**毎月1日にすべてがリセットされるSNS。**
内部のログイン用アカウントだけは継続するが、利用者から見える情報（名前・アイコン・投稿・フォロー・いいね・返信・公開ID）は毎月まるごと消える。過去の自分を引きずらずに、毎月「違う自分」で参加し直せる場所。

検証したい問い：**「つながりが消えても、翌月また参加したくなるか」**

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/concept.md](docs/concept.md) | 誰のためのSNSか・提供する価値・検証したいこと |
| [docs/requirements.md](docs/requirements.md) | 機能と毎月リセットのルール（MVP） |
| [docs/architecture.md](docs/architecture.md) | サーバー・DB・認証の構成、データの分け方 |
| [docs/roadmap.md](docs/roadmap.md) | 作る順番 |
| [docs/decisions.md](docs/decisions.md) | 決定事項とその理由 |
| [docs/development-log.md](docs/development-log.md) | 作業内容と次にやること |

## AI開発ルール

- [CLAUDE.md](CLAUDE.md) — Claude Code 向け
- [AGENTS.md](AGENTS.md) — Codex など向け

いずれも「作業前に docs を読む」「仕様を変えたら docs も更新する」「作業終了時にログを残す」がルール。

## 現在のステータス

**フェーズ0: 準備中。** 仕様ドキュメントとAI開発ルールを整備した段階。
次はホスティング・DB・認証の選定と、画面の試作品（フェーズ1）。詳しくは [docs/roadmap.md](docs/roadmap.md) を参照。

## 秘密情報について

パスワード・APIキーなどは環境変数で管理し、**このリポジトリにはコミットしない**。
