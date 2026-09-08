"use client";

import { Icon } from "./Icon";
import { useState, useRef } from "react";
import { useStore } from "@/lib/store";

export function PostComposer() {
  const { state, createPost, busy } = useStore();
  const [text, setText] = useState("");

  const operation = useRef<string | null>(null);
  const onPost = async () => {
    operation.current ??= crypto.randomUUID();
    if (await createPost(text, operation.current)) { setText(""); operation.current = null; }
  };

  const noName = !state.me.displayName.trim();

  return (
    <div className="card composer">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="avatar">{state.me.icon}</div>
        <textarea
          className="grow"
          aria-label="投稿内容"
          rows={3}
          placeholder={
            noName
              ? "その前に、プロフィールで今月の名前を決めよう"
              : "いま、何を感じてる？"
          }
          value={text}
          maxLength={500}
          disabled={busy}
          onChange={(e) => {setText(e.target.value); operation.current = null;}}
        />
      </div>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 13, marginRight: "auto" }}>
          月末にすべて消えます
        </span>
        <button className="btn" onClick={onPost} disabled={busy || noName || !text.trim()}>
          投稿する <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

