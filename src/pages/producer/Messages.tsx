import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import ProducerLayout from "./ProducerLayout";
import MessagingWorkspace, { type MessagingConversationItem } from "@/components/MessagingWorkspace";
import type { PitchCardData } from "@/components/ChatMessageList";
import { chatThemes, type ChatThemeId } from "@/components/chatThemes";
import { mongodbClient } from "@/lib/mongodb/client";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface ConversationGroup {
  id: string;
  conversation_ids: string[];
  writer_id: string;
  writer_name: string;
  writer_avatar: string | null;
  script_title: string | null;
  unread_count: number;
  last_message_at: string;
  last_message: string | null;
}

interface RawConversation {
  id: string;
  producer_id: string;
  writer_id: string;
  script_id: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface ProfileSummary {
  name?: string | null;
  avatar_url?: string | null;
}

interface ScriptSummary {
  title?: string | null;
}

interface MessagePreview {
  content?: string | null;
  created_at?: string | null;
}

interface MongoResponse<T> {
  data: T | null;
  error?: { message?: string } | null;
  count?: number | null;
}

interface RealtimeChannelLike {
  on: (...args: unknown[]) => RealtimeChannelLike;
  subscribe: () => RealtimeChannelLike;
}

interface RealtimeClientLike {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => void;
}

const sortByRecent = <T extends { last_message_at: string }>(items: T[]) =>
  [...items].sort(
    (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime(),
  );

const Messages = () => {
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTheme] = useState<ChatThemeId>("superhero-command");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const theme = chatThemes[activeTheme];
  const realtimeClient = mongodbClient as unknown as RealtimeClientLike;

  const getCurrentUser = async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchConversations = useCallback(async () => {
    const { data: convos, error } = await mongodbClient
      .from("conversations")
      .select("id, producer_id, writer_id, script_id, last_message_at, updated_at, created_at")
      .eq("producer_id", currentUserId)
      .order("last_message_at", { ascending: false }) as MongoResponse<RawConversation[]>;

    if (error || !convos) return;

    const enriched = await Promise.all(
      convos.map(async (conv) => {
        const { data: profile } = await mongodbClient
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", conv.writer_id)
          .single() as MongoResponse<ProfileSummary>;

        let scriptTitle = null;
        if (conv.script_id) {
          const { data: script } = await mongodbClient
            .from("scripts")
            .select("title")
            .eq("_id", conv.script_id)
            .maybeSingle() as MongoResponse<ScriptSummary>;
          scriptTitle = script?.title || null;
        }

        const { data: lastMessageRow } = await mongodbClient
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle() as MongoResponse<MessagePreview>;

        const { count } = await mongodbClient
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("read", false)
          .neq("sender_id", currentUserId) as MongoResponse<null>;

        return {
          ...conv,
          writer_name: profile?.name || "Writer",
          writer_avatar: profile?.avatar_url || null,
          script_title: scriptTitle,
          unread_count: count || 0,
          last_message: lastMessageRow?.content || null,
          last_message_at: lastMessageRow?.created_at || conv.last_message_at || conv.updated_at || conv.created_at,
        };
      }),
    );

    const grouped = sortByRecent(
      enriched.reduce<ConversationGroup[]>((groups, conversation) => {
        const existingGroup = groups.find((group) => group.writer_id === conversation.writer_id);

        if (!existingGroup) {
          groups.push({
            id: conversation.writer_id,
            conversation_ids: [conversation.id],
            writer_id: conversation.writer_id,
            writer_name: conversation.writer_name,
            writer_avatar: conversation.writer_avatar,
            script_title: conversation.script_title,
            unread_count: conversation.unread_count,
            last_message_at: conversation.last_message_at,
            last_message: conversation.last_message,
          });
          return groups;
        }

        existingGroup.conversation_ids.push(conversation.id);
        existingGroup.unread_count += conversation.unread_count;

        if (
          new Date(conversation.last_message_at || 0).getTime() >
          new Date(existingGroup.last_message_at || 0).getTime()
        ) {
          existingGroup.last_message_at = conversation.last_message_at;
          existingGroup.last_message = conversation.last_message;
          existingGroup.script_title = conversation.script_title;
        }

        return groups;
      }, []),
    );

    setConversations(grouped);
    if (!selectedConversation && grouped.length > 0) {
      setSelectedConversation(grouped[0].id);
    }
  }, [currentUserId, selectedConversation]);

  const markMessagesAsRead = useCallback(async (conversationIds: string[]) => {
    if (!conversationIds.length) return;

    await mongodbClient
      .from("messages")
      .update({ read: true })
      .in("conversation_id", conversationIds)
      .eq("read", false)
      .neq("sender_id", currentUserId);
    fetchConversations();
  }, [currentUserId, fetchConversations]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    const selectedGroup = conversations.find((conversation) => conversation.id === conversationId);
    if (!selectedGroup?.conversation_ids.length) {
      setMessages([]);
      return;
    }

    const { data } = await mongodbClient
      .from("messages")
      .select("*")
      .in("conversation_id", selectedGroup.conversation_ids)
      .order("created_at", { ascending: true }) as MongoResponse<Message[]>;

    setMessages(data || []);
    markMessagesAsRead(selectedGroup.conversation_ids);
  }, [conversations, markMessagesAsRead]);

  const subscribeToMessages = useCallback((conversationId: string) => {
    const selectedGroup = conversations.find((conversation) => conversation.id === conversationId);
    const selectedConversationIds = new Set(selectedGroup?.conversation_ids || []);

    const channel = realtimeClient
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const incomingMessage = (payload as { new?: Message }).new as Message | undefined;
          if (!incomingMessage?.conversation_id || !selectedConversationIds.has(incomingMessage.conversation_id)) {
            return;
          }

          setMessages((prev) => [...prev, incomingMessage]);
        },
      )
      .subscribe();

    return () => { realtimeClient.removeChannel(channel); };
  }, [conversations, realtimeClient]);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) fetchConversations();
  }, [currentUserId, fetchConversations]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedConversation = params.get("conversation");
    if (!requestedConversation || !conversations.length) return;

    const matchingConversation = conversations.find((conversation) => conversation.id === requestedConversation);
    if (matchingConversation) {
      setSelectedConversation(matchingConversation.id);
    }
  }, [location.search, conversations]);

  useEffect(() => {
    if (!currentUserId) return;

    const interval = window.setInterval(() => {
      fetchConversations();
      if (selectedConversation) {
        fetchMessages(selectedConversation);
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [currentUserId, selectedConversation, fetchConversations, fetchMessages]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      const cleanup = subscribeToMessages(selectedConversation);
      return cleanup;
    }
  }, [selectedConversation, fetchMessages, subscribeToMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? newMessage).trim();
    if (!content || !selectedConversation) return;

    const selectedGroup = conversations.find((conversation) => conversation.id === selectedConversation);
    const targetConversationId = selectedGroup?.conversation_ids[0];
    if (!targetConversationId) return;

    const { error } = await mongodbClient.from("messages").insert({
      conversation_id: targetConversationId,
      sender_id: currentUserId,
      content,
      read: false,
    }) as MongoResponse<null>;
    if (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      return;
    }

    await mongodbClient
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("_id", targetConversationId);

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversation_id: targetConversationId,
        sender_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        read: false,
      },
    ]);
    if (!overrideContent) {
      setNewMessage("");
    }
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1200);

    await trackEvent({
      event_type: "MESSAGE_SENT",
      script_id: null,
      metadata: {
        conversation_id: targetConversationId,
        writer_id: selectedGroup.writer_id,
        writer_name: selectedGroup.writer_name,
        script_title: selectedGroup.script_title || null,
      },
    });

    fetchConversations();
  };

  const deleteMessage = async (messageId: string) => {
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    const { error } = await mongodbClient
      .from("messages")
      .delete()
      .eq("_id", messageId) as MongoResponse<null>;

    if (error) {
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
      return;
    }

    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    fetchConversations();
    toast({ title: "Message deleted" });
  };

  const handlePitchAction = (action: "view" | "discuss" | "accept", pitch: PitchCardData) => {
    if (action === "view") {
      toast({
        title: pitch.title,
        description: pitch.logline,
      });
      return;
    }

    if (action === "discuss") {
      setNewMessage(`Let's discuss "${pitch.title}" with a focus on packaging, target audience, and the next development step.`);
      return;
    }

    setNewMessage(`I want to move forward with "${pitch.title}". Let's review terms, timeline, and the next creative meeting.`);
  };

  const filteredConversations: MessagingConversationItem[] = conversations
    .filter((conv) =>
      conv.writer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.script_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.last_message?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .map((conv) => ({
      id: conv.id,
      name: conv.writer_name,
      avatar: conv.writer_avatar,
      scriptTitle: conv.script_title,
      unreadCount: conv.unread_count,
      lastMessageAt: conv.last_message_at,
      lastMessage: conv.last_message,
      roleLabel: "Writer",
      status: conv.unread_count > 0 ? "Online" : "Last seen recently",
    }));

  return (
    <ProducerLayout>
      <MessagingWorkspace
        conversations={filteredConversations}
        selectedConversationId={selectedConversation}
        onSelectConversation={setSelectedConversation}
        messages={messages}
        currentUserId={currentUserId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        newMessage={newMessage}
        onNewMessageChange={setNewMessage}
        onSendMessage={sendMessage}
        onDeleteMessage={deleteMessage}
        onPitchAction={handlePitchAction}
        isTyping={isTyping}
        typingLabel={`${filteredConversations.find((conversation) => conversation.id === selectedConversation)?.name || "Writer"} is typing...`}
        emptySidebarTitle="No conversations yet"
        emptySidebarDescription="Writers you message will appear here."
        emptyChatTitle="Select a conversation"
        emptyChatDescription="Choose a writer from the sidebar to continue discussing scripts and next steps."
        panelLabel="Producer Inbox"
        theme={theme}
        messagesEndRef={messagesEndRef}
      />
    </ProducerLayout>
  );
};

export default Messages;
