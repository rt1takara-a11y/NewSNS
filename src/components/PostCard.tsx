"use client";

import { Icon } from "./Icon";
import { useState, useRef } from "react";
import type { Post } from "@/lib/types";
import { useStore, useProfileLookup } from "@/lib/store";
import { timeAgo } from "@/lib/format";

export function PostCard({ post }: { post: Post }) {
  const { state, toggleLike, addReply, busy, blockPerson, reportPost, deletePost } = useStore();
  const lookup = useProfileLookup();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const author = lookup(post.authorPublicId);
  const liked = post.likedBy.includes(state.me.publicId);

  const operation = useRef<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const onReply = async () => {
    operation.current ??= crypto.randomUUID();
    if (await addReply(post.id, replyText, operation.current)) { setReplyText(""); setShowReply(false); operation.current = null; }
  };

  return (
    <article className="card post-card">
      <div className="post-head">
        <div className="avatar">{author?.icon ?? "👤"}</div>
        <div>
          <div className="name">{author?.displayName || "（名前未設定）"}</div>
          <div className="handle">今月のつながり</div>
        </div>
        <div className="time">{timeAgo(post.createdAt)}</div>
      </div>

      <p className="post-body">{post.body}</p>

      <div className="actions">
        <button
          className={liked ? "action liked" : "action"}
          onClick={() => toggleLike(post.id)}
          disabled={busy}
          aria-pressed={liked}
          aria-label={liked ? "いいねを取り消す" : "いいね"}
        >
          <Icon name="heart" /> {post.likedBy.length > 0 ? post.likedBy.length : ""}
        </button>
        <button className="action" aria-expanded={showReply} aria-label="返信する" onClick={() => setShowReply((v) => !v)}>
          <Icon name="reply" /> {post.replies.length > 0 ? post.replies.length : "返信"}
        </button>
      </div>

      {post.replies.length > 0 && (
        <div className="replies">
          {post.replies.map((r) => {
            const ra = lookup(r.authorPublicId);
            return (
              <div className="reply" key={r.id}>
                <div className="avatar">{ra?.icon ?? "👤"}</div>
                <div>
                  <div className="name" style={{ fontSize: 13 }}>
                    {ra?.displayName || "（名前未設定）"}{" "}
                    <span className="handle">・{timeAgo(r.createdAt)}</span>
                  </div>
                  <div>{r.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReply && (
        <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <textarea
            className="grow"
            aria-label="返信内容"
            rows={2}
            placeholder="今月のこの人に返信…"
            value={replyText}
            maxLength={500}
            disabled={busy}
            onChange={(e) => {setReplyText(e.target.value); operation.current = null;}}
          />
          <button className="btn small" onClick={onReply} disabled={busy || !state.me.displayName.trim() || !replyText.trim()}>
            返信
          </button>
        </div>
      )}
      <details className="post-options"><summary>投稿の操作</summary><div className="row">
        {post.authorPublicId === state.me.publicId
          ? <button className="action" disabled={busy} onClick={() => {if(window.confirm("この投稿を非表示にしますか？")) void deletePost(post.id);}}>自分の投稿を非表示</button>
          : <><button className="action" onClick={() => setReporting(v => !v)}>通報する</button><button className="action" disabled={busy} onClick={() => {if(window.confirm("この人を今月ブロックしますか？互いの投稿が表示されなくなります。")) void blockPerson(post.authorPublicId, true);}}>ブロック</button></>}
      </div></details>
      {reporting && <form className="report-form" onSubmit={async e => {e.preventDefault();if(await reportPost(post.id, reason)){setReported(true);setReporting(false);setReason("");}}}><label>通報の理由<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="btn small" disabled={busy || !reason.trim()}>通報を送信</button></form>}
      {reported && <p role="status" className="muted">通報を受け付けました。</p>}
    </article>
  );
}

