"use client";
import {useStore} from '@/lib/store';
export default function About(){
 const {live}=useStore(); const support=process.env.NEXT_PUBLIC_SUPPORT_URL;
 return <><header className="topbar"><div className="eyebrow">ABOUT RE:ME</div><h1>今月を、安心して。</h1></header><div className="content"><section className="card"><h2>毎月リセットされるもの</h2><p>日本時間の毎月1日 0:00に、公開プロフィール・投稿・フォロー・いいね・返信・ブロックを切り替えます。前月のプロフィールはサービス内でたどれません。</p><p>ログイン用アカウントと利用停止状態は継続します。スクリーンショットや外部への転載は消せません。</p></section><section className="card"><h2>困ったときは</h2><p>投稿の「投稿の操作」から通報・ブロックできます。誹謗中傷、個人情報の無断公開、なりすまし、嫌がらせを目的とした投稿はしないでください。</p>{support && /^(https:\/\/|mailto:)/.test(support)?<a className="btn ghost" href={support}>運営へ問い合わせる</a>:<p className="muted">一般向けの参加受付は準備中です。</p>}</section><section className="card"><h2>データについて</h2><p>メールアドレスはログインに使用し、他の利用者のプロフィールには表示しません。通報内容とその時点の投稿・アカウントの対応は、運営が対応するために保管します。</p><p>公開から消えたデータは運営領域に最大90日を目安に保管します。保全が必要な通報記録は別途保持する場合があります。運営者情報と正式な利用規約・プライバシーポリシーは、一般公開前に案内します。</p>{!live&&<p className="notice">現在は体験版です。入力内容はサーバーへ保存されず、再読み込みすると初期状態に戻ります。</p>}</section></div></>;
}
