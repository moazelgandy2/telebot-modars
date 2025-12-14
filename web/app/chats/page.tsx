'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar, User } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatSession {
  id: string;
  userId: string;
  username: string | null;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

export default function ChatsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chat/history')
      .then((res) => res.json())
      .then((data) => {
          if(Array.isArray(data)) setSessions(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">سجل المحادثات</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <Link href={`/chats/${session.userId}`} key={session.id} className="block transition-transform hover:scale-[1.02]">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <CardTitle className="text-base font-medium">
                    {session.username ? `@${session.username.replace('@', '')}` : session.userId}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">ID: {session.userId}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{session._count.messages} رسالة</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: ar })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {sessions.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            لا توجد محادثات مسجلة حتى الآن.
          </div>
        )}
      </div>
    </div>
  );
}
