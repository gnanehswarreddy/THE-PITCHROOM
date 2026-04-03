import { mongodbClient, type AnalyticsEventType, type ScriptRecord } from "@/lib/mongodb/client";

type TrackPayload = {
  event_type: AnalyticsEventType;
  script_id?: string | null;
  story_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(payload: TrackPayload) {
  try {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user?.id) return;

    await mongodbClient.analytics.track({
      ...payload,
      user_id: user.id,
    });
  } catch (error) {
    console.warn("Analytics tracking failed", error);
  }
}

export function buildScriptMetadata(script: Partial<ScriptRecord> | null | undefined, extras: Record<string, unknown> = {}) {
  const ownerId = script?.writer_id || script?.userId || script?.author?.id || null;
  return {
    script_owner_id: ownerId,
    script_title: script?.title || null,
    genre: script?.genre || null,
    ...extras,
  };
}
