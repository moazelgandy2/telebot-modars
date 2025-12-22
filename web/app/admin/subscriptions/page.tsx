"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Plus, RefreshCcw, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Subscription {
    id: string;
    userId: string;
    name: string | null;
    createdAt: string;
    startDate: string;
    endDate: string | null;
}

interface ChatSession {
    id: string;
    userId: string;
    username: string | null;
    updatedAt: string;
}

export default function SubscriptionsPage() {
    const [subs, setSubs] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(false);

    // User Selector State
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [newName, setNewName] = useState("");

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const observer = useRef<IntersectionObserver | null>(null);
    const { toast } = useToast();

    const fetchSubs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/subscription");
            const data = await res.json();
            if (data.success) {
                setSubs(data.data);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to fetch subscriptions", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const fetchSessions = useCallback(async (reset = false) => {
        if (loadingUsers && !reset) return;
        setLoadingUsers(true);
        try {
            const currentPage = reset ? 1 : page;
            const res = await fetch(`/api/chat/history?q=${searchQuery}&page=${currentPage}&limit=10`);
            const data = await res.json();

            if (Array.isArray(data)) {
                if (reset) {
                    setSessions(data);
                    setPage(2);
                } else {
                    setSessions(prev => [...prev, ...data]);
                    setPage(prev => prev + 1);
                }
                setHasMore(data.length === 10);
            }
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        } finally {
            setLoadingUsers(false);
        }
    }, [page, searchQuery, loadingUsers]);

    // Initial fetch
    useEffect(() => {
        fetchSubs();
    }, []);

    // Search Debounce Effect
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSessions(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Infinite Scroll Ref
    const lastElementRef = useCallback((node: HTMLDivElement) => {
        if (loadingUsers) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchSessions();
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingUsers, hasMore, fetchSessions]);


    const handleAdd = async () => {
        if (!selectedUserId) return;
        try {
            const res = await fetch("/api/subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: selectedUserId, name: newName }),
            });
            const json = await res.json();
            if (json.success) {
                toast({ title: "Subscription added", description: `Added ${selectedUserId}` });
                setSelectedUserId("");
                setNewName("");
                fetchSubs();
            } else {
                toast({ title: "Error", description: json.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to add", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this subscription?")) return;
        try {
            const res = await fetch(`/api/subscription?userId=${id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                 toast({ title: "Deleted", description: "Subscription removed" });
                 fetchSubs();
            } else {
                 toast({ title: "Error", description: json.error || "Failed to delete", variant: "destructive" });
            }
        } catch (e) {
             toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
        }
    }

    return (
        <div className="container mx-auto py-10 px-4">
            <Card>
                <CardHeader>
                    <CardTitle>Subscription Management</CardTitle>
                     <CardDescription>Manage users who have access to the bot's academic features.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                        <div className="flex-1 w-full flex flex-col gap-2">
                             <label className="text-sm font-medium">User</label>
                             <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                    >
                                    {selectedUserId
                                        ? sessions.find((s) => s.userId === selectedUserId)?.username
                                            ? `${sessions.find((s) => s.userId === selectedUserId)?.username} (${selectedUserId})`
                                            : selectedUserId
                                        : "Select user..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder="Search user..."
                                        value={searchQuery}
                                        onValueChange={setSearchQuery}
                                    />
                                    <CommandList>
                                        <CommandEmpty>No user found.</CommandEmpty>
                                        <CommandGroup>
                                        {sessions.map((session) => (
                                            <CommandItem
                                            key={session.id}
                                            value={session.userId}
                                            onSelect={(currentValue) => {
                                                setSelectedUserId(currentValue === selectedUserId ? "" : currentValue);
                                                if (session.username && !newName) setNewName(session.username); // Auto-fill name
                                                setOpen(false);
                                            }}
                                            >
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedUserId === session.userId ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span>{session.username || "Unknown"}</span>
                                                <span className="text-xs text-muted-foreground">{session.userId}</span>
                                            </div>
                                            </CommandItem>
                                        ))}
                                          <div ref={lastElementRef} className="py-2 text-center text-xs text-muted-foreground">
                                              {loadingUsers && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
                                          </div>
                                        </CommandGroup>
                                    </CommandList>
                                    </Command>
                                </PopoverContent>
                                </Popover>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-sm font-medium mb-1 block">Name (Optional)</label>
                             <Input
                                placeholder="Student Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                             />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleAdd} disabled={!selectedUserId}>
                                <Plus className="mr-2 h-4 w-4" /> Add
                            </Button>
                            <Button variant="outline" onClick={() => { fetchSubs(); fetchSessions(true); }} disabled={loading}>
                                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subs.map((sub) => {
                                    const isActive = !sub.endDate || new Date(sub.endDate) > new Date();
                                    return (
                                    <TableRow key={sub.id}>
                                        <TableCell className="font-mono text-xs">{sub.userId}</TableCell>
                                        <TableCell>{sub.name || "-"}</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium",
                                                isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            )}>
                                                {isActive ? "Active" : "Expired"}
                                            </span>
                                        </TableCell>
                                        <TableCell>{new Date(sub.startDate).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : <span className="text-muted-foreground italic">Lifetime</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(sub.userId)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                                {subs.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No subscriptions found</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
