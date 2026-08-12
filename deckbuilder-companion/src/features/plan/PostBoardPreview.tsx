"use client";

/**
 * SPEC-D Task D-10 (FR-6.10). A read-only preview of `postBoardDeck`,
 * reusing SPEC-B's `DeckView` rather than a bespoke render. Changed cards
 * (removed, added, quantity-reduced) are marked by diffing the pre- and
 * post-board maindecks by card id.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { countCards } from "@/domain/deck/queries";
import { postBoardDeck } from "@/domain/plan/postBoard";
import type { CardId, Deck, SideboardPlan } from "@/domain/model/types";
import { useCardRepository } from "@/state/WorkspaceProvider";
import { DeckView } from "@/features/deck/DeckView";

export interface PostBoardPreviewProps {
  readonly deck: Deck;
  readonly plan: SideboardPlan;
}

function ChangeList({ plan }: Pick<PostBoardPreviewProps, "plan">) {
  const repo = useCardRepository();
  const cardName = (cardId: CardId) => repo.peek(cardId)?.name ?? cardId;

  if (plan.out.length === 0 && plan.in.length === 0) return null;

  return (
    <ul data-testid="post-board-preview-changes" className="mb-4 space-y-1 text-sm">
      {plan.out.map((entry) => (
        <li
          key={`out-${entry.cardId}`}
          data-testid="post-board-change-removed"
          className="text-red-600 dark:text-red-400"
        >
          − {entry.quantity}× {cardName(entry.cardId)}
        </li>
      ))}
      {plan.in.map((entry) => (
        <li
          key={`in-${entry.cardId}`}
          data-testid="post-board-change-added"
          className="text-green-600 dark:text-green-400"
        >
          + {entry.quantity}× {cardName(entry.cardId)}
        </li>
      ))}
    </ul>
  );
}

export function PostBoardPreview({ deck, plan }: PostBoardPreviewProps) {
  const [open, setOpen] = useState(false);
  const postBoard = postBoardDeck(deck, plan);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-testid="post-board-preview-trigger"
          className="border-border rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Preview post-board deck
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          data-testid="post-board-preview-dialog"
          className="bg-background border-border fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-foreground text-lg font-semibold">
              Post-board deck
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="post-board-preview-close"
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description
            data-testid="post-board-preview-count"
            className="text-foreground mb-4 text-sm font-medium"
          >
            {countCards(postBoard.maindeck)} cards
          </Dialog.Description>
          <ChangeList plan={plan} />
          <DeckView deck={postBoard} compact />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
