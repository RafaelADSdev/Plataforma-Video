"use client";

import { ThumbsUp } from "lucide-react";
import { useActionState, useId } from "react";
import { setThreadLikeAction } from "@/app/actions/community";
import { initialActionState } from "@/lib/action-state";

export function CommunityLikeButton({ threadId, title, count, liked, showLabel = false }: {
  threadId: string;
  title: string;
  count: number;
  liked: boolean;
  showLabel?: boolean;
}) {
  const countId = useId();
  const [state, action, pending] = useActionState(setThreadLikeAction.bind(null, threadId), initialActionState);

  return (
    <form action={action} className="thread-like-form">
      <input type="hidden" name="liked" value={liked ? "false" : "true"} />
      <button
        className="button secondary small thread-like-button"
        type="submit"
        aria-label={`Curtir: ${title}`}
        aria-describedby={countId}
        aria-pressed={liked}
        disabled={pending}
      >
        <ThumbsUp aria-hidden="true" size={16} />
        {showLabel ? <span aria-hidden="true">Curtir</span> : null}
        <span aria-hidden="true">{count}</span>
        <span className="sr-only" id={countId}>{count === 1 ? "1 curtida" : `${count} curtidas`}</span>
      </button>
      {state.message ? <p className="field-error" role="alert">{state.message}</p> : null}
    </form>
  );
}
