'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bot, FileIcon, Download, ExternalLink } from "lucide-react";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: string;
  content: string;
  imageUrl?: string;
  attachments?: { id: string; url: string; type: string }[];
  createdAt: string;
}

const MediaAttachment = ({ url }: { url: string }) => {
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes("/video/");
    const isPDF = url.match(/\.pdf$/i);

    if (isImage) {
        return (
            <div className="mb-2 relative group">
                <img
                    src={url}
                    alt="attachment"
                    className="rounded-md max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                />
            </div>
        );
    }

    if (isVideo) {
        return (
            <div className="mb-2 max-w-[300px]">
                <video controls className="w-full rounded-md" src={url} />
            </div>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 mb-2 bg-background/50 rounded-md border border-border/50 hover:bg-background/80 transition-colors group"
        >
            <div className="p-2 bg-primary/10 rounded-full text-primary">
                {isPDF ? <FileIcon className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">ملف مرفق</p>
                <p className="text-xs text-muted-foreground truncate dir-ltr text-left">{url.split('/').pop()}</p>
            </div>
            <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100" />
        </a>
    );
};

export default function ChatDetailsPage() {
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const fetchMessages = () => {
        fetch(`/api/chat/history?userId=${id}`)
            .then((res) => res.json())
            .then((data) => {
                if(Array.isArray(data)) {
                    setMessages(data);
                }
            })
            .catch((err) => console.error("Failed to poll messages:", err))
            .finally(() => setLoading(false));
    };

    // Initial fetch
    fetchMessages();

    // Poll every 3 seconds
    const interval = setInterval(fetchMessages, 3000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loading) {
     return <div className="p-8 text-center text-muted-foreground">جاري تحميل المحادثة...</div>;
  }

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">محادثة: {id}</h1>
      </div>

      <Card className="flex-1 p-4 overflow-hidden relative bg-slate-50 dark:bg-slate-900 border-none shadow-inner">
         <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pb-4">
                {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-3",
                                isUser ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                             <Avatar className="h-8 w-8">
                                <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}>
                                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                </AvatarFallback>
                            </Avatar>

                            <div className={cn(
                                "flex flex-col gap-1 max-w-[85%]",
                                isUser ? "items-end" : "items-start"
                            )}>
                                <span className="text-xs text-muted-foreground px-1">
                                    {isUser ? "المستخدم" : "البوت"}
                                </span>
                                <div
                                    className={cn(
                                        "rounded-lg px-3 py-2 text-sm shadow-sm w-full overflow-hidden",
                                        isUser
                                        ? "bg-primary text-primary-foreground rounded-tr-none"
                                        : "bg-white dark:bg-card border rounded-tl-none"
                                    )}
                                >
                                    {(() => {
                                        const allAttachments = [
                                            ...(msg.imageUrl ? [{ id: 'legacy', url: msg.imageUrl, type: 'image' }] : []),
                                            ...(msg.attachments || [])
                                        ];

                                        if (allAttachments.length === 0) return null;

                                        return (
                                            <div className={cn("grid gap-2 mb-2", allAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                                                {allAttachments.map((att, i) => (
                                                    <MediaAttachment
                                                        key={i}
                                                        url={att.url}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    {msg.content && (
                                        <div className={cn("leading-relaxed prose prose-sm dark:prose-invert max-w-none broke-words", isUser ? "text-primary-foreground prose-p:text-primary-foreground prose-a:text-white underline" : "")}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="underline font-bold" />
                                            }}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] opacity-70 px-1">
                                    {format(new Date(msg.createdAt), "pp", { locale: ar })}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>
         </ScrollArea>
      </Card>
    </div>
  );
}
