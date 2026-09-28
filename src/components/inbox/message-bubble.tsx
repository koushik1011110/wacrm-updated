"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction, MessageTemplate } from "@/types";
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  MapPin,
  LayoutTemplate,
  ImageOff,
  CornerDownLeft,
  ExternalLink,
  Phone,
  Download,
  Maximize2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";

interface MessageBubbleProps {
  message: Message;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
  templateDef?: MessageTemplate;
  contactName?: string;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sending":
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <ImageOff className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const loadImage = useCallback(async () => {
    if (!url) return;

    // Proxy URLs need auth fetch to create blob URL
    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load media");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImage]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleDownload = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const downloadUrl = src || url;
      if (!downloadUrl) return;

      try {
        let blob: Blob;
        if (downloadUrl.startsWith("blob:")) {
          const res = await fetch(downloadUrl);
          blob = await res.blob();
        } else {
          const res = await fetch(downloadUrl);
          if (!res.ok) throw new Error("Failed to fetch image for download");
          blob = await res.blob();
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        const extension = blob.type.split("/")[1] || "jpg";
        a.download = `whatsapp-image-${Date.now()}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (err) {
        console.error("Image download failed:", err);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `whatsapp-image-${Date.now()}.jpg`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    [src, url]
  );

  if (error) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-muted">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-lg"
        onClick={() => setIsOpen(true)}
      >
        <img
          src={src ?? ""}
          alt={alt}
          className="max-h-64 max-w-60 rounded-lg object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          onError={() => setError(true)}
        />
        {/* Hover overlay with action buttons */}
        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/90"
            title="View large"
          >
            <Maximize2 className="h-3 w-3" />
            <span>View</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/90"
            title="Download image"
          >
            <Download className="h-3 w-3" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Lightbox / Fullscreen Modal */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          >
            {/* Top Toolbar */}
            <div
              className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-white/90">
                <span className="text-sm font-medium truncate max-w-xs">{alt || "Image"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  title="Download Image"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Center Image */}
            <div
              className="relative max-w-full max-h-[85vh] flex items-center justify-center select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src ?? ""}
                alt={alt}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl transition-transform"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function formatWhatsAppText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={lineIdx} className="block min-h-[1.25rem]">
        {parts.map((part, partIdx) => {
          if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
            return (
              <strong key={partIdx} className="font-semibold">
                {part.slice(1, -1)}
              </strong>
            );
          }
          return part;
        })}
      </span>
    );
  });
}

function MessageContent({
  message,
  isAgent,
  templateDef,
  contactName,
}: {
  message: Message;
  isAgent: boolean;
  templateDef?: MessageTemplate;
  contactName?: string;
}) {
  switch (message.content_type) {
    case "text":
      return (
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content_text ? formatWhatsAppText(message.content_text) : ""}
        </div>
      );

    case "image":
      return (
        <div>
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {message.content_text && (
            <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {formatWhatsAppText(message.content_text)}
            </div>
          )}
        </div>
      );

    case "video":
      return (
        <div>
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 max-w-60 rounded-lg"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {message.content_text && (
            <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {formatWhatsAppText(message.content_text)}
            </div>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls className="max-w-60" />
          ) : (
            <MediaUnavailable label="Audio" />
          )}
        </div>
      );

    case "document":
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || "Document"} />;
      }
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
        >
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {message.content_text || "Document"}
          </span>
        </a>
      );

    case "template": {
      const headerText = templateDef?.header_content;
      const footerText = templateDef?.footer_text;

      let buttons = templateDef?.buttons;
      if (message.interactive_reply_id) {
        try {
          const parsed = JSON.parse(message.interactive_reply_id);
          if (Array.isArray(parsed) && parsed.length > 0) {
            buttons = parsed;
          }
        } catch {}
      }

      let displayText = message.content_text || templateDef?.body_text || "";
      if (displayText && contactName) {
        displayText = displayText.replace(/\{\{1\}\}/g, contactName);
      }
      displayText = displayText.replace(/\{\{\d+\}\}/g, "");

      const isDoc =
        message.media_url &&
        (/\.pdf($|\?)/i.test(message.media_url) ||
          message.media_url.includes("/document/"));
      const isVid =
        message.media_url &&
        /\.(mp4|mov|webm)($|\?)/i.test(message.media_url);

      return (
        <div className="flex flex-col">
          {/* Header Media (Image, Video, Document) */}
          {message.media_url && (
            <div className="mb-2">
              {isDoc ? (
                <a
                  href={message.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    isAgent
                      ? "bg-black/20 text-white hover:bg-black/30"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  <FileText className="h-5 w-5 shrink-0 opacity-80" />
                  <span className="truncate font-medium">View Document</span>
                </a>
              ) : isVid ? (
                <video
                  src={message.media_url}
                  controls
                  className="max-h-64 max-w-60 rounded-lg"
                />
              ) : (
                <MediaImage url={message.media_url} alt="Template media" />
              )}
            </div>
          )}

          {/* Text Header (e.g. "KKWEBMART: Invoice Generated") */}
          {!message.media_url && headerText && (
            <div className="font-bold text-sm tracking-tight mb-1 text-inherit opacity-95">
              {headerText}
            </div>
          )}

          {/* Body Text */}
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {displayText ? formatWhatsAppText(displayText) : null}
          </div>

          {/* Footer Text */}
          {footerText && (
            <div
              className={cn(
                "text-[11px] mt-1.5 opacity-75 font-normal tracking-wide",
                isAgent ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {footerText}
            </div>
          )}

          {/* Action Buttons */}
          {buttons && buttons.length > 0 && (
            <div
              className={cn(
                "mt-2.5 -mx-3 -mb-2 border-t flex flex-col divide-y",
                isAgent
                  ? "border-black/15 divide-black/15"
                  : "border-border/80 divide-border/80"
              )}
            >
              {buttons.map((btn, i) => {
                if (btn.type === "URL") {
                  let href = btn.url;
                  if (href.includes("{{1}}")) {
                    const urlMatch = displayText.match(/https?:\/\/[^\s]+/i);
                    const numMatch =
                      displayText.match(/#(?:INV|EST)-(\d+)/i) ||
                      displayText.match(/id=(\d+)/i);

                    if (
                      urlMatch &&
                      (urlMatch[0].includes("print_") ||
                        urlMatch[0].includes("receipt") ||
                        urlMatch[0].includes("invoice") ||
                        urlMatch[0].includes("quotation") ||
                        urlMatch[0].includes("sign"))
                    ) {
                      href = urlMatch[0];
                    } else if (numMatch && numMatch[1]) {
                      href = href.replace(
                        /\{\{1\}\}/g,
                        String(parseInt(numMatch[1], 10))
                      );
                    } else {
                      href = href.replace(/\{\{1\}\}/g, btn.example || "1");
                    }
                  }
                  return (
                    <a
                      key={i}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition-colors hover:bg-black/10 first:rounded-t-none last:rounded-b-2xl",
                        isAgent ? "text-white" : "text-primary hover:text-primary"
                      )}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span>{btn.text}</span>
                    </a>
                  );
                }
                if (btn.type === "PHONE_NUMBER") {
                  return (
                    <a
                      key={i}
                      href={`tel:${btn.phone_number || ""}`}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition-colors hover:bg-black/10 first:rounded-t-none last:rounded-b-2xl",
                        isAgent ? "text-white" : "text-primary hover:text-primary"
                      )}
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{btn.text}</span>
                    </a>
                  );
                }
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium opacity-90 cursor-default"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />
                    <span>{btn.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "location":
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{message.content_text || "Location shared"}</span>
        </div>
      );

    case "interactive": {
      // Customer tapped a reply button or list row on a message the bot
      // sent. We show the tapped option's title (already in content_text,
      // set by parseMessageContent in the webhook) with a small affordance
      // so agents reading the inbox can tell at a glance that this is a
      // tap rather than the customer typing the same words.
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <CornerDownLeft className="h-3 w-3" />
            Button reply
          </span>
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.content_text || "[Interactive reply]"}
          </p>
        </div>
      );
    }

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content_text || "[Unsupported message type]"}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
  templateDef,
  contactName,
}: MessageBubbleProps) {
  const isAgent = message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");

  // Row alignment + width cap are owned by <MessageActions> so its hover
  // group matches the bubble's content area, not the full row.
  return (
    <div
      className={cn(
        "flex flex-col",
        isAgent ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "relative rounded-2xl px-3 py-2",
          isAgent
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        {reply && (
          <ReplyQuote
            authorLabel={reply.authorLabel}
            preview={reply.preview}
            onPrimary={isAgent}
          />
        )}
        <MessageContent
          message={message}
          isAgent={isAgent}
          templateDef={templateDef}
          contactName={contactName}
        />
        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          {message.content_type === "template" && (
            <LayoutTemplate className="h-3 w-3 opacity-60 mr-0.5" />
          )}
          <span
            className={cn(
              "text-[10px]",
              // Outbound bubbles sit on the primary fill, so the
              // timestamp must read against that (not the neutral
              // foreground) — otherwise it goes low-contrast in light
              // mode. Inbound bubbles use the muted surface.
              isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {time}
          </span>
          {isAgent && <StatusIcon status={message.status} />}
        </div>
      </div>
      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
