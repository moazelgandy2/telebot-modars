'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, Settings, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'الرئيسية', icon: Home },
  { href: '/chats', label: 'المحادثات', icon: MessageSquare },
  { href: '/system-instruction', label: 'توجيهات النظام', icon: ClipboardList },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-l bg-card text-card-foreground"> {/* border-r to border-l for RTL aesthetics if needed, but in RTL layout border-e is safer. actually border-r in RTL is the left side? No, border-inline-end. Let's stick to standard behavior or just use border-border with RTL safe usually. border-r in RTL appears on the right? Wait. In RTL, 'right' is right. We want the border to separate sidebar from content. If sidebar is on right (default RTL?), border should be on left. In RTL mode, usually sidebar stays on start (right). So we need border-l (left). */}
      <div className="p-6 border-b">
        <h1 className="text-lg font-bold">بوت رحلة تالته ثانوي</h1>
        <p className="text-sm text-muted-foreground">لوحة التحكم 🤖 </p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <span className="font-medium text-base">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t text-sm text-muted-foreground opacity-50 flex justify-center">
        v1.0.0
      </div>
    </div>
  );
}
