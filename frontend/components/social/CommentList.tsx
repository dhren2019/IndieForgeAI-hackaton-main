import React, { useState, useEffect } from "react";
import { Button }   from "../ui/Button";
import { Loader }   from "../ui/Loader";
import { apiGetComments, apiAddComment } from "../../lib/api";
import { timeAgo }  from "../../lib/formatters";
import type { PostComment } from "../../types/social";

interface CommentListProps {
  postId:    number;
  onToast:   (msg: string, kind?: "ok" | "error") => void;
}

export function CommentList({ postId, onToast }: CommentListProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    apiGetComments(postId).then(({ data }) => {
      if (data) setComments(data);
      setLoading(false);
    });
  }, [postId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const { data, error } = await apiAddComment(postId, trimmed);
    if (data) {
      setComments((c) => [...c, data]);
      setText("");
      onToast("Comentario publicado");
    } else {
      onToast(error ?? "Error al comentar", "error");
    }
    setSending(false);
  };

  if (loading) return <Loader size="sm" label="Cargando comentarios…" />;

  return (
    <div className="comment-list">
      {comments.length === 0 && (
        <p className="comment-list__empty">Sin comentarios. ¡Sé el primero!</p>
      )}
      {comments.map((c) => (
        <div className="comment-item" key={c.id}>
          <div className="comment-item__meta">
            <span className="comment-item__author">{c.author}</span>
            <span className="comment-item__time">{timeAgo(c.created_at)}</span>
          </div>
          <p className="comment-item__content">{c.content}</p>
        </div>
      ))}

      <div className="comment-input">
        <input
          className="comment-input__field"
          placeholder="Escribe un comentario… (Enter para enviar)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          maxLength={300}
        />
        <Button
          variant="primary"
          size="sm"
          loading={sending}
          disabled={!text.trim()}
          onClick={handleSend}
        >↵</Button>
      </div>
    </div>
  );
}
