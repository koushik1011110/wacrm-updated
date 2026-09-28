"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CornerUpLeft, Copy, SmilePlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Message } from "@/types";

// WhatsApp's own quick-reaction bar starts with these six.
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageActionsProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete?: (messageId: string) => void;
  children: ReactNode;
}

/**
 * Hover, context-menu (right-click), and long-press action wrapper around `<MessageBubble>`.
 * Supports replying, reacting, copying text, and deleting the message via right-click or toolbar.
 */
export function MessageActions({
  message,
  onReply,
  onReact,
  onDelete,
  children,
}: MessageActionsProps) {
  const [touchOpen, setTouchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";

  // Right-click opens custom context menu at mouse coordinates
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 190;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    setContextMenuPos({
      x: Math.max(12, x),
      y: Math.max(12, y),
    });
  };

  // Close context menu on outside click, window blur, resize, scroll, or Esc key
  useEffect(() => {
    if (!contextMenuPos) return;

    const closeMenu = () => setContextMenuPos(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenuPos(null);
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuPos]);

  const handleCopy = async () => {
    const text = message.content_text ?? "";
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
    setTouchOpen(false);
    setContextMenuPos(null);
  };

  const handlePickEmoji = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
    setTouchOpen(false);
    setContextMenuPos(null);
  };

  const handleReply = () => {
    onReply();
    setTouchOpen(false);
    setContextMenuPos(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${message.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete message");
      }
      toast.success("Message deleted");
      setDeleteConfirmOpen(false);
      onDelete?.(message.id);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete message";
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex w-full select-text",
          isAgent ? "justify-end" : "justify-start"
        )}
        onContextMenu={handleContextMenu}
        onBlur={() => setTouchOpen(false)}
      >
        <div className="group/actions relative min-w-0 max-w-[75%]">
          {children}

          {/* Hover / Long-press Quick Toolbar */}
          <div
            data-touch-open={touchOpen || pickerOpen ? "true" : undefined}
            className={cn(
              "absolute -top-3 z-10 flex h-7 items-center gap-0.5 rounded-full border border-border bg-popover/95 px-1 shadow-md backdrop-blur-sm transition-opacity",
              "opacity-0 group-hover/actions:opacity-100 group-focus-within/actions:opacity-100",
              "data-[touch-open=true]:opacity-100",
              isAgent ? "right-3" : "left-3"
            )}
          >
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
                aria-label="React"
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </PopoverTrigger>
              <PopoverContent
                className="flex w-auto flex-row gap-1 p-1.5 shadow-lg"
                sideOffset={6}
              >
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => handlePickEmoji(e)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-muted"
                    aria-label={`React with ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={handleReply}
              className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
              aria-label="Reply"
              title="Reply"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>

            {message.content_text && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-5 w-5 items-center justify-center rounded-full text-popover-foreground hover:bg-muted hover:text-foreground"
                aria-label="Copy"
                title="Copy text"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              aria-label="Delete"
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right-click Floating Context Menu */}
      {contextMenuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: `${contextMenuPos.x}px`,
              top: `${contextMenuPos.y}px`,
            }}
            className="z-50 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Quick emoji reactions strip */}
            <div className="flex items-center justify-between gap-1 px-1 py-1">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => handlePickEmoji(e)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-base leading-none transition-transform hover:scale-125 hover:bg-muted"
                  aria-label={`React with ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="my-1.5 h-px bg-border/60" />

            {/* Reply option */}
            <button
              type="button"
              onClick={handleReply}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-popover-foreground transition-colors hover:bg-muted"
            >
              <CornerUpLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Reply</span>
            </button>

            {/* Copy option */}
            {message.content_text && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-popover-foreground transition-colors hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Copy Text</span>
              </button>
            )}

            <div className="my-1.5 h-px bg-border/60" />

            {/* Delete Message option */}
            <button
              type="button"
              onClick={() => {
                setContextMenuPos(null);
                setDeleteConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Message</span>
            </button>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Message
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This message will be permanently removed from this conversation thread.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
