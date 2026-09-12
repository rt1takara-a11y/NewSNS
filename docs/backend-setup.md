# RE:ME — Supabase接続と運用手順

## 引き継ぎ時点の接続状況（2026-09-12）

Supabase実環境作成・初期migration適用済み。所有者はメール確認コードでのログイン、再読み込み後の保存、同一アカウントの別端末共有、別アカウントの投稿閲覧を確認済み。

今回取得したローカルcheckoutには環境変数ファイルがなく、公開設定3項目もプロセスに未設定。RE:MEのSitesランタイム変数にも登録はなかった。静的exportのため実サイトには過去のビルド時設定が埋め込まれている可能性があり、ランタイム未登録だけでは未接続と判断しない。再ビルドして公開する際は設定値の安全な受け渡しが必要。値をチャットやGitへ貼らない。

他ユーザープロフィールは既存RPCだけで動き、追加migrationは不要。今回はローカルのテスト・ビルドのみ実施し、実環境・SMTP・Sites設定・デプロイは変更していない。以下は初回セットアップ手順として残す。

## 実装した構成

- 画面: 既存Next.jsのstatic export。既存のSites本人限定プレビューを維持。
- 認証: Supabase AuthのメールOTP（確認コード）。ブラウザ内に保存するのは認証セッションで、投稿データの保存先ではない。
- データ: Supabase PostgreSQL。`reme_private`スキーマの全テーブルはブラウザから直接アクセス不可。RLSと権限剥奪を併用。
- 公開API: `public.reme_state()` と `public.reme_mutate(action,payload,expected_epoch)` だけ。
- サーバーの`auth.uid()`と日本時間で本人・期間を判定。内部アカウントの対応表・メール・通報記録はレスポンスに含めない。
- 月替わり: 毎リクエストで有効期間を算出するため、cronが遅れても前月データを取得できない。新プロフィールを初回アクセス時に発行。
- 画面: 15秒間隔およびフォーカス復帰時に同期。サーバーが返す月末までの時間で画面を更新。ネットワーク遅延はあり得る。古い画面からの書き込みは`PERIOD_CHANGED`で拒否。

## 初回接続に必要な作業

1. 自分が所有するSupabaseプロジェクトを作る。プロジェクト/課金/SMTPの設定はこの環境に接続されていないため代行未実施。
2. SQL Editorで `supabase/migrations/202609080001_reme.sql` を実行する。適用後はこのファイルを書き換えず、次のmigrationを追加する。
3. Auth > Emailでメールログインを有効にする。Magic Linkテンプレートの本文を、リンクではなく `{{ .Token }}` を表示する確認コード形式にする。コードは6〜8桁を受け付ける。
4. Auth > SMTPに送信用プロバイダーを設定する。Supabase既定のメール送信は用途・宛先・回数に制限があるため、友人への実配信前にカスタムSMTPを検証する。実際の宛先への送信は所有者が確認して行う。
5. `.env.example`を`.env.local`にコピーし、次の公開設定値を入力する。
   - `NEXT_PUBLIC_SUPABASE_URL`: プロジェクトURL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Publishable key（旧anon keyもクライアント互換）
   - `NEXT_PUBLIC_SUPPORT_URL`: 運営が確認する問い合わせフォームURLまたはmailto URL
   **service_role、sb_secret、DBパスワードをNEXT_PUBLIC変数に入れない。**
6. `npm ci` → `npm test` → `npm run build`。NEXT_PUBLIC値はビルド時に埋め込まれる。静的exportなので、公開後にランタイム変数だけ変えても反映されない。設定変更後は再ビルドする。
7. 2人の実メールでコード送信・受信・認証・再読み込み・別端末共有を確認する。期限切れコード、ログアウト、保存失敗も確認する。
8. プライベートな90日保持を暫定運用値としてレビューし、pg_cronを有効にして `supabase/schedule-maintenance.sql` を実行する。毎日JST 00:20に期限切れデータを掃除する。ジョブ履歴で成功を確認する。
9. 友人を招く前に、運営者情報、利用規約、プライバシーポリシー、問い合わせ窓口、メール送信設定、ホスト側の閲覧権限を確定する。今のSites URLは本人限定で、メールログインだけでは閲覧許可は増えない。招待や公開範囲の変更は別の作業。

設定値が両方未入力の場合は「体験版」の表示付きで既存デモを使う。これはサーバー保存の動作確認にはならない。カスタムSMTPと保守ジョブの設定状況は今回未確認。

## 運営操作（所有者のSQL Editor専用）

ブラウザ利用者に管理者権限を付けない。以下はDB所有者のみが実行する。

```sql
-- 未対応の通報一覧。運営情報なので外部に貼らない。
select id, subject_account, subject_id, reason, snapshot, created_at
from reme_private.reports where not resolved order by created_at;

-- 利用停止。対象UUIDを通報のsubject_accountで確認してから実行。
select reme_private.suspend_account('確認した内部アカウントUUID', true);

-- 投稿/返信を非表示にする。UUIDを確認してから実行。
update reme_private.posts set hidden = true where id = '確認した投稿UUID';
update reme_private.replies set hidden = true where id = '確認した返信UUID';

-- 対応済みにする / 保存が必要な記録を保持する。
update reme_private.reports set resolved = true where id = '確認した通報UUID';
update reme_private.reports set legal_hold = true where id = '確認した通報UUID';
```

1週間のリセット実験は参加者に予告し、所有者が `select reme_private.test_reset();` を実行する。**全参加者**の表示が切り替わる。利用停止や通報記録は継続する。一般利用者にはこの関数を呼ぶ権限がない。

## 現時点の範囲と制限

- テキスト投稿500字、名前30字、ひとこと160字。最新100投稿を表示。大規模運用向けのページングや配信最適化は未実装。
- 1アカウントあたり1分30回の書き込み制限。全体のボット対策・不正登録対策はSupabase側の設定も必要。
- 投稿と返信は操作UUIDで再送を重複防止。いいね/フォローは明示的なON/OFF。保存失敗時は入力を保持。
- 通報UIは投稿が対象。返信の非表示は運営SQLで対応する。
- ブロックは月次の関係としてリセットされ、次月の相手との対応は利用者に公開しない。
- 古い公開データは運営領域に暫定90日保持。通報時には本文と内部対応を別途コピーし、保全フラグ付き記録を削除対象から除く。
- IP/アクセスログを保全する仕組みは未実装。現構成だけで法的な発信者特定や開示対応が完結するとは扱わない。
- 退会・データ削除の自動UIは未実装。初期試験は運営問い合わせで受け付ける。公開前に削除と記録保持の手順を確定する。
- SMTP課金、Supabase利用量、Sites公開条件について契約や料金変更は行っていない。

## 参照した公式資料

- [メールOTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [メールテンプレート](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SMTPの設定と制限](https://supabase.com/docs/guides/auth/auth-smtp)
- [DB関数の権限](https://supabase.com/docs/guides/database/functions)

確認日: 2026-09-08。料金の固定保証はしない。
