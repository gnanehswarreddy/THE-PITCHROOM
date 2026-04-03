import { useState, useEffect, useCallback } from "react";
import { mongodbClient } from "@/lib/mongodb/client";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const { data, error } = await mongodbClient
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as unknown as Notification[]);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    }
    setLoading(false);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await mongodbClient
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    await mongodbClient
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    await mongodbClient.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notif && !notif.read) setUnreadCount(prev => Math.max(0, prev - 1));
  }, [notifications]);

  useEffect(() => {
    fetchNotifications();

    // Real-time subscription
    const channel = mongodbClient
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as unknown as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      mongodbClient.removeChannel(channel);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}
