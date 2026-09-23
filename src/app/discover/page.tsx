"use client";

import { useStore } from "@/lib/store";
import { periodLabel } from "@/lib/period";
import { ProfileLink } from "@/components/ProfileLink";

export default function DiscoverPage() {
  const { state, toggleFollow, discoverPeople, busy, live } = useStore();

  return (
    <>
      <header className="topbar">
        <div className="eyebrow">NEW CONNECTIONS</div>
        <h1>今週の出会い</h1>
        <div className="period">{periodLabel(state.period)}に参加している人たち</div>
      </header>

      <div className="content">
        <div className="notice">
          先週フォローしていた人は、もう探せません。公開IDは毎週変わり、前週の人はたどれない仕組みです。
          今週の出会いは、今週だけ。
        </div>

        {state.people.length === 0 ? (
          <div className="empty">
            <div className="big">🔍</div>
            <p>まだ表示できる人がいません。</p>
            <p>
              <button className="btn" disabled={busy} onClick={discoverPeople}>
                {live ? "更新する" : "今週の人をさがす"}
              </button>
            </p>
          </div>
        ) : (
          state.people.map((p) => {
            const following = state.following.includes(p.publicId);
            return (
              <div className="card" key={p.publicId}>
                <div className="post-head">
                  <ProfileLink profile={p} icon />
                  <div>
                    <ProfileLink profile={p} />
                    <div className="handle">今週のメンバー</div>
                  </div>
                  <button
                    className={following ? "btn ghost small" : "btn small"}
                    style={{ marginLeft: "auto" }}
                    disabled={busy}
                    aria-pressed={following}
                    onClick={() => toggleFollow(p.publicId)}
                  >
                    {following ? "フォロー中" : "フォロー"}
                  </button>
                </div>
                {p.bio && <p className="post-body" style={{ marginBottom: 0 }}>{p.bio}</p>}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
