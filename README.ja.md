<div align="center">

# skillfit

**スキルレジストリが教えてくれるのは「何が人気か」。skillfit が教えてくれるのは「何が本当に効くか」。**

スキル・ルールファイル・MCP 設定が、**あなたの**エージェントで、**あなたの**タスクに対して、本当に改善になるかを測定する——<br/>
そして実験を生き残ったものだけをインストールする。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[クイックスタート](#クイックスタート) · [ベンチガイド](benches/README.md) · [指標プロトコル](docs/metrics.md) · [エビデンス](evidence/)

</div>

---

## なぜ

エージェント設定のエコシステムは**配布**（`npx skills add`、プラグインマーケットプレイス、MCP レジストリ）は解決したが、**選択**は解決していない。エビデンスが示す通り、未検証の設定は害になりうる：

- キュレーション済みスキルはパス率を平均 **+16.6pp** 向上させる——しかしエージェントが自分で生成したスキルは **−1.3pp** で、大きなバンドルよりも焦点を絞ったスキルのほうが優れている（[SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670)）
- LLM が生成したコンテキストファイルはスコアが **−3%** になる一方、推論コストを 20% 以上押し上げた（[ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988)）
- スキャンされた公開スキルの 36% にプロンプトインジェクションが含まれていた（[Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)）

skillfit は欠けていた測定レイヤーである：決定的ベリファイアを備えたペア A/B 実験、統計的判定、トリガー率の測定——誰でも実行できる CLI としてパッケージ化されている。

## 何が得られるか

実際の実行例：スキルがインストールされているものの明示的に言及されていない場合に、エージェントが**わざわざロードするかどうか**を測定したものだ：

```console
$ npx skillfit eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
```

ドメイン内の 9 タスク中、このスキルが発火したのは 1 回だけ——しかもタスクはスキルなしでも 3/3 でパスしている。これはどんなレジストリも出せない判定だ。

## クイックスタート

```bash
# 1. 現在のセットアップをヘルスチェック（読み取り専用・安全）
npx skillfit doctor

# 2. インストール前にスキルを A/B テスト（同梱ベンチを名前で選ぶか、自分のパスを渡す。
#    --agent で API キーの代わりにローカルのエージェント CLI を駆動できる）
npx skillfit eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. あるいは、エージェントが自発的にスキルをトリガーするか（そしてすべきでないときに発火しないか）を測定
npx skillfit eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. エビデンスに裏付けられた最小セットだけをインストール（デフォルトは dry-run）
npx skillfit install

# 任意：エージェントに使い方を教える（driver skill を agents ディレクトリにコピー）
cp -r skills/skillfit ~/.agents/skills/
```

対応エージェント：**Claude Code**、**OpenAI Codex CLI**、**Kimi Code**（[能力マトリクス](src/matrix/agents.json) — 機械可読・検証日付付き・ドキュメントへのリンクあり）。トリガーモードのキャプチャは現在 Kimi Code と Codex CLI で検証済み。

## 5 つのコマンド

| コマンド | 機能 | 書き込み？ |
|---|---|---|
| `doctor` | インストール済みエージェントの検出、ルールの肥大化、スキルの妥当性・競合、MCP 設定のパース可能性、サイレント失敗の罠（例：Claude Code が決して読まない AGENTS.md）をチェック | 一切なし |
| `report` | ローカルセッション履歴からスキルの実使用を集計：スキルごとの発火回数と未発火リスト（純粋なルーティング/コンテキスト税） | 一切なし |
| `eval <skill>` | デフォルト（`--mode inject`）：ペア baseline/treatment 実行、決定的ベリファイア + オプションのブラインド LLM 審査、トークンコスト差分、McNemar 正確検定 + ペア bootstrap CI による判定。`--mode trigger`：プロンプト注入の代わりにスキルを実際にインストールし、エージェントのトランスクリプトからトリガー再現率 / 誤発火率を測定 | ローカルの `runs/` のみ |
| `bench` | `init` は動作するサンプルタスク付きのベンチディレクトリをスキャフォールド。`check` はベンチをオフラインで検証（ベリファイアの自己テスト、モックアームのプローブ、フィクスチャの健全性、トリガーラベルのカバレッジ）。`add --freeze` は目撃したばかりの失敗を恒久的なベンチタスクに変換する | `init`/`add` は確認後のみ、`check` は一切なし |
| `install` | 管理ブロックへのルール書き込み（`<!-- SKILLFIT_START/END -->`、冪等・アトミック）、競合保護付きのスキルコピー、コミット固定のロックファイル、インストール後の検証 | 確認後のみ |

## ベンチを持ち込む

評価の質はタスクの質を超えられない。ベンチは単なるディレクトリ——`bench.json` + フィクスチャ + 決定的ベリファイアだ。`npx skillfit bench init` でスキャフォールドし、エージェントが失敗した現場を目撃したら `npx skillfit bench add <bench> --freeze` で恒久的なタスクとして凍結し、`npx skillfit bench check` でオフライン検証し、自分の本番シナリオに倣って作る：[benches/README.md](benches/README.md)。

## 私たち自身のデータ

skillfit のハーネスで人気のワークフロースキル 8 個を測定した（24 組の baseline/treatment ペア、Codex CLI、2026-07 凍結ベースライン）。**8 個中 1 個だけが再現可能な効果を示した**：

| スキル | 品質 Δ | 入力トークン | 判定 |
|---|---:|---:|---|
| `diagnosing-bugs` | テスト資産 +66.7pp 増（2/3 実行） | +11.7% | **条件付き** — 難しいバグのみ |
| `code-review` | +3.3pp（不安定） | +9.1% | 証拠不十分 |
| `tdd` | 0.00pp | +9.2% | 測定可能な効果なし |
| `doubt-driven-development` | 0.00pp | +20.7% | 測定可能な効果なし |
| `security-and-hardening` | 0.00pp | +27.4% | 測定可能な効果なし・コスト最大 |
| 残り 3 個 | 0.00pp | +14.7~17.0% | 測定可能な効果なし |

完全な方法論と生のマニフェストは [evidence/](evidence/) を参照。`skillfit eval` で自分でも再現できる。

## 設計原則

- **フォーマットではなく、標準に乗る。** AGENTS.md（AAIF）、SKILL.md、`.agents/skills/`、`.mcpb`——エージェントがすでに読むものだけを書き込む。
- **デフォルト拒否。** プロファイルが明示的に宣言したものだけを、コンテンツハッシュで固定してインストールする。
- **dry-run 優先。** すべての書き込みコマンドは、ファイルに触れる前に計画を表示する。バックアップは常に取得する。
- **誠実な数字。** すべての主張は、モデルバージョン・スキルハッシュ・日付・分散を含むマニフェストにリンクされる。判定の意味論は [docs/metrics.md](docs/metrics.md) に凍結されている：有意性は不一致ペアに対する McNemar 正確検定から得られ、差分はペア bootstrap 信頼区間を伴い、検出力不足の実行は *indicative* とラベル付けされ、決して「有効」とは書かれない。

## 免責事項

Anthropic、OpenAI、Moonshot AI、その他いかなるエージェントベンダーとも関係はない。評価結果はモデルバージョン・ハーネス・タスクに依存する——日付入りのエビデンスとして扱い、永遠の真実とは考えないこと。

## ロードマップ

- [x] doctor / eval / install のコアループ
- [x] ブラインド審査付きペア A/B ハーネス
- [x] 統計的判定（McNemar 正確検定 + ペア bootstrap CI、manifest v2）
- [x] トリガー率の測定（`--mode trigger`：再現率 / 誤発火率、Wilson 信頼区間付き）
- [x] ベンチのスキャフォールド（`bench init` + `bench check`）、失敗の凍結（`--freeze`）、git 履歴マイニング（`--from-commit`）、難易度キャリブレーション（`--calibrate`）
- [ ] Claude Code 向けトリガーキャプチャ（認証不可で保留中）
- [ ] コミュニティのベンチ＆エビデンス投稿（trust-me な結果ではなく、再現可能な設定の CI 再実行）
- [ ] Cursor / Gemini CLI / OpenCode アダプター
- [ ] MCP サーバー設定の評価

## コントリビュート

[CONTRIBUTING.md](CONTRIBUTING.md) を参照。最も価値のあるコントリビューションは、あなたの実際のワークフローから作られたベンチだ。リリースノートは [CHANGELOG.md](CHANGELOG.md)、セキュリティ報告は [SECURITY.md](SECURITY.md) に。

## ライセンス

[MIT](LICENSE)
