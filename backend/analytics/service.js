import { ObjectId } from "mongodb";
import {
  ANALYTICS_AUDIENCES,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_EVENT_TYPE_SET,
  DEFAULT_ANALYTICS_DAYS,
} from "./constants.js";

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

function cleanString(value) {
  return String(value ?? "").trim();
}

function cleanNullableString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function cleanMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * MILLISECONDS_IN_DAY);
}

function formatDateKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function formatLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function clampDays(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_ANALYTICS_DAYS), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ANALYTICS_DAYS;
  return Math.min(parsed, 365);
}

function resolveRange({ days, start, end }) {
  const today = new Date();
  const safeDays = clampDays(days);

  if (start || end) {
    const startDate = start ? startOfDay(new Date(start)) : startOfDay(addDays(today, -safeDays + 1));
    const endDate = end ? endOfDay(new Date(end)) : endOfDay(today);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid analytics date range");
    }
    return {
      days: Math.max(1, Math.round((endOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / MILLISECONDS_IN_DAY) + 1),
      startDate,
      endDate,
    };
  }

  return {
    days: safeDays,
    startDate: startOfDay(addDays(today, -safeDays + 1)),
    endDate: endOfDay(today),
  };
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function round(value, digits = 1) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function buildEventRelevanceFilter({ userId, audience, startDate, endDate }) {
  const timestampFilter = { timestamp: { $gte: startDate, $lte: endDate } };

  if (audience === ANALYTICS_AUDIENCES.PRODUCER) {
    return {
      ...timestampFilter,
      user_id: userId,
    };
  }

  return {
    ...timestampFilter,
    $or: [
      { user_id: userId },
      { "metadata.script_owner_id": userId },
      { "metadata.story_owner_id": userId },
      { "metadata.profile_owner_id": userId },
      { "metadata.writer_id": userId },
    ],
  };
}

function buildActorFilter({ userId, startDate, endDate }) {
  return {
    user_id: userId,
    timestamp: { $gte: startDate, $lte: endDate },
  };
}

function getEventCount(events, type, predicate = null) {
  return events.filter((event) => event.event_type === type && (!predicate || predicate(event))).length;
}

function normalizeGenre(value) {
  const genre = cleanString(value);
  if (!genre) return "Unknown";
  return genre
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferTrendDirection(growthPercentage) {
  if (growthPercentage > 5) return "up";
  if (growthPercentage < -5) return "down";
  return "flat";
}

function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function fetchTitlesByIds(collection, ids, idField = "_id", titleField = "title") {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  let filter;
  if (idField === "_id") {
    const objectIds = uniqueIds.map(toObjectId).filter(Boolean);
    if (!objectIds.length) return new Map();
    filter = { _id: { $in: objectIds } };
  } else {
    filter = { [idField]: { $in: uniqueIds } };
  }

  const docs = await collection.find(filter, { projection: { [titleField]: 1, [idField]: 1 } }).toArray();
  return new Map(
    docs.map((doc) => [
      idField === "_id" ? doc._id.toString() : String(doc[idField]),
      cleanString(doc[titleField]) || "Untitled",
    ]),
  );
}

function calculateSessions(events, userId) {
  const actorEvents = events
    .filter((event) => event.user_id === userId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!actorEvents.length) {
    return {
      averageSessionActivity: 0,
      sessionCount: 0,
    };
  }

  const sessions = [];
  let currentSessionCount = 0;
  let previousTime = null;

  for (const event of actorEvents) {
    const currentTime = new Date(event.timestamp).getTime();
    if (previousTime === null || currentTime - previousTime > 30 * 60 * 1000) {
      if (currentSessionCount > 0) sessions.push(currentSessionCount);
      currentSessionCount = 1;
    } else {
      currentSessionCount += 1;
    }
    previousTime = currentTime;
  }

  if (currentSessionCount > 0) sessions.push(currentSessionCount);

  return {
    averageSessionActivity: round(sessions.reduce((sum, count) => sum + count, 0) / sessions.length, 1),
    sessionCount: sessions.length,
  };
}

export class AnalyticsService {
  constructor({ db }) {
    this.db = db;
    this.events = db.collection("events");
  }

  async ensureIndexes() {
    await Promise.all([
      this.events.createIndex({ user_id: 1, timestamp: -1 }),
      this.events.createIndex({ event_type: 1, timestamp: -1 }),
      this.events.createIndex({ "metadata.script_owner_id": 1, timestamp: -1 }),
      this.events.createIndex({ "metadata.story_owner_id": 1, timestamp: -1 }),
      this.events.createIndex({ "metadata.profile_owner_id": 1, timestamp: -1 }),
      this.events.createIndex({ script_id: 1, timestamp: -1 }),
      this.events.createIndex({ story_id: 1, timestamp: -1 }),
      this.db.collection("writer_follows").createIndex({ follower_id: 1, writer_id: 1 }, { unique: true }),
    ]);
  }

  validateTrackPayload(payload = {}, fallbackUserId = null) {
    const eventType = cleanString(payload.event_type).toUpperCase();
    const userId = cleanNullableString(fallbackUserId || payload.user_id);
    const scriptId = cleanNullableString(payload.script_id);
    const storyId = cleanNullableString(payload.story_id);
    const metadata = cleanMetadata(payload.metadata);
    const rawTimestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    if (!userId) throw new Error("user_id is required");
    if (!eventType || !ANALYTICS_EVENT_TYPE_SET.has(eventType)) {
      throw new Error(`event_type must be one of: ${[...ANALYTICS_EVENT_TYPE_SET].join(", ")}`);
    }
    if (Number.isNaN(rawTimestamp.getTime())) {
      throw new Error("timestamp must be a valid date");
    }

    return {
      user_id: userId,
      event_type: eventType,
      script_id: scriptId,
      story_id: storyId,
      metadata,
      timestamp: rawTimestamp,
      created_at: rawTimestamp.toISOString(),
    };
  }

  async trackEvent(payload = {}, fallbackUserId = null) {
    const event = this.validateTrackPayload(payload, fallbackUserId);
    const result = await this.events.insertOne(event);
    return {
      id: result.insertedId.toString(),
      ...event,
      timestamp: event.timestamp.toISOString(),
    };
  }

  async seedDemoEvents({ userId, audience = ANALYTICS_AUDIENCES.WRITER }) {
    const range = resolveRange({ days: 30 });
    const scripts = await this.db
      .collection("scripts")
      .find({ $or: [{ writer_id: userId }, { userId }] }, { projection: { title: 1, genre: 1, sourceStoryId: 1 } })
      .limit(3)
      .toArray();
    const stories = await this.db
      .collection("stories")
      .find({ user_id: userId }, { projection: { title: 1, genre: 1 } })
      .limit(3)
      .toArray();

    const scriptSeeds = scripts.length
      ? scripts.map((script) => ({
          scriptId: script._id.toString(),
          title: cleanString(script.title) || "Untitled Script",
          genre: normalizeGenre(script.genre),
          storyId: cleanNullableString(script.sourceStoryId),
        }))
      : [
          { scriptId: `demo-script-${userId}-1`, title: "Midnight Signal", genre: "Thriller", storyId: `demo-story-${userId}-1` },
          { scriptId: `demo-script-${userId}-2`, title: "Neon Tides", genre: "Sci Fi", storyId: `demo-story-${userId}-2` },
        ];

    const storySeeds = stories.length
      ? stories.map((story) => ({
          storyId: story._id?.toString?.() || cleanString(story.id),
          title: cleanString(story.title) || "Untitled Story",
          genre: normalizeGenre(story.genre),
        }))
      : [
          { storyId: `demo-story-${userId}-1`, title: "Midnight Signal", genre: "Thriller" },
          { storyId: `demo-story-${userId}-2`, title: "Neon Tides", genre: "Sci Fi" },
        ];

    const events = [];

    for (let dayOffset = 0; dayOffset < 18; dayOffset += 1) {
      const day = addDays(range.startDate, dayOffset);
      const seedScript = scriptSeeds[dayOffset % scriptSeeds.length];
      const seedStory = storySeeds[dayOffset % storySeeds.length];
      const baseMetadata = {
        script_owner_id: userId,
        story_owner_id: userId,
        profile_owner_id: userId,
        script_title: seedScript.title,
        story_title: seedStory.title,
        genre: seedScript.genre || seedStory.genre,
      };

      events.push({
        user_id: userId,
        event_type: ANALYTICS_EVENT_TYPES.STORY_CREATED,
        story_id: seedStory.storyId,
        script_id: null,
        metadata: {
          ...baseMetadata,
          source: "demo-seed",
        },
        timestamp: addDays(day, 0),
        created_at: addDays(day, 0).toISOString(),
      });

      events.push({
        user_id: userId,
        event_type: ANALYTICS_EVENT_TYPES.SCRIPT_GENERATED,
        story_id: seedStory.storyId,
        script_id: seedScript.scriptId,
        metadata: {
          ...baseMetadata,
          source: "demo-seed",
        },
        timestamp: new Date(day.getTime() + 60 * 60 * 1000),
        created_at: new Date(day.getTime() + 60 * 60 * 1000).toISOString(),
      });

      const viewCount = 2 + (dayOffset % 4);
      for (let index = 0; index < viewCount; index += 1) {
        const viewerId = audience === ANALYTICS_AUDIENCES.WRITER ? `viewer-${index}` : userId;
        const viewedAt = new Date(day.getTime() + (2 + index) * 60 * 60 * 1000);
        events.push({
          user_id: viewerId,
          event_type: ANALYTICS_EVENT_TYPES.SCRIPT_VIEW,
          script_id: seedScript.scriptId,
          story_id: seedStory.storyId,
          metadata: {
            ...baseMetadata,
            source: "demo-seed",
          },
          timestamp: viewedAt,
          created_at: viewedAt.toISOString(),
        });
      }

      if (dayOffset % 2 === 0) {
        const savedAt = new Date(day.getTime() + 6 * 60 * 60 * 1000);
        events.push({
          user_id: audience === ANALYTICS_AUDIENCES.WRITER ? `producer-save-${dayOffset}` : userId,
          event_type: ANALYTICS_EVENT_TYPES.SCRIPT_SAVE,
          script_id: seedScript.scriptId,
          story_id: seedStory.storyId,
          metadata: {
            ...baseMetadata,
            source: "demo-seed",
          },
          timestamp: savedAt,
          created_at: savedAt.toISOString(),
        });
      }

      if (dayOffset % 3 === 0) {
        const messageAt = new Date(day.getTime() + 8 * 60 * 60 * 1000);
        events.push({
          user_id: audience === ANALYTICS_AUDIENCES.WRITER ? `producer-message-${dayOffset}` : userId,
          event_type: ANALYTICS_EVENT_TYPES.MESSAGE_SENT,
          script_id: seedScript.scriptId,
          story_id: seedStory.storyId,
          metadata: {
            ...baseMetadata,
            source: "demo-seed",
          },
          timestamp: messageAt,
          created_at: messageAt.toISOString(),
        });
      }

      if (dayOffset % 5 === 0) {
        const pitchAt = new Date(day.getTime() + 10 * 60 * 60 * 1000);
        events.push({
          user_id: userId,
          event_type: ANALYTICS_EVENT_TYPES.PITCH_SENT,
          script_id: seedScript.scriptId,
          story_id: seedStory.storyId,
          metadata: {
            ...baseMetadata,
            source: "demo-seed",
          },
          timestamp: pitchAt,
          created_at: pitchAt.toISOString(),
        });
      }
    }

    if (audience === ANALYTICS_AUDIENCES.PRODUCER) {
      const writerId = cleanString(scripts[0]?.writer_id) || "writer-demo";
      const profileViewedAt = addDays(range.endDate, -2);
      events.push({
        user_id: userId,
        event_type: ANALYTICS_EVENT_TYPES.PROFILE_VIEW,
        script_id: null,
        story_id: null,
        metadata: {
          profile_owner_id: writerId,
          profile_name: "Featured Writer",
          source: "demo-seed",
        },
        timestamp: profileViewedAt,
        created_at: profileViewedAt.toISOString(),
      });
      const followAt = addDays(range.endDate, -1);
      events.push({
        user_id: userId,
        event_type: ANALYTICS_EVENT_TYPES.FOLLOW_WRITER,
        script_id: null,
        story_id: null,
        metadata: {
          writer_id: writerId,
          profile_owner_id: writerId,
          profile_name: "Featured Writer",
          source: "demo-seed",
        },
        timestamp: followAt,
        created_at: followAt.toISOString(),
      });
    }

    if (!events.length) return { insertedCount: 0 };
    const result = await this.events.insertMany(events, { ordered: false });
    return { insertedCount: result.insertedCount };
  }

  async getAnalytics({ userId, audience = ANALYTICS_AUDIENCES.WRITER, days, start, end }) {
    const { startDate, endDate, days: resolvedDays } = resolveRange({ days, start, end });
    const relevantFilter = buildEventRelevanceFilter({ userId, audience, startDate, endDate });
    const actorFilter = buildActorFilter({ userId, startDate, endDate });

    const [relevantEvents, actorEvents] = await Promise.all([
      this.events.find(relevantFilter).sort({ timestamp: 1 }).toArray(),
      this.events.find(actorFilter).sort({ timestamp: 1 }).toArray(),
    ]);

    const totalViews = getEventCount(relevantEvents, ANALYTICS_EVENT_TYPES.SCRIPT_VIEW);
    const scriptsSaved = getEventCount(relevantEvents, ANALYTICS_EVENT_TYPES.SCRIPT_SAVE);
    const messagesSent = getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.MESSAGE_SENT);
    const pitchesSent = getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.PITCH_SENT);
    const scriptsGenerated = getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.SCRIPT_GENERATED);
    const profileViews = getEventCount(relevantEvents, ANALYTICS_EVENT_TYPES.PROFILE_VIEW);
    const followCount = getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.FOLLOW_WRITER);

    const last7Start = startOfDay(addDays(endDate, -6));
    const previous7Start = startOfDay(addDays(last7Start, -7));
    const previous7End = endOfDay(addDays(last7Start, -1));
    const last7Count = relevantEvents.filter((event) => new Date(event.timestamp) >= last7Start).length;
    const previous7Count = await this.events.countDocuments(
      buildEventRelevanceFilter({
        userId,
        audience,
        startDate: previous7Start,
        endDate: previous7End,
      }),
    );
    const growthPercentage = previous7Count === 0
      ? (last7Count > 0 ? 100 : 0)
      : round(((last7Count - previous7Count) / previous7Count) * 100, 1);

    const dailyMap = new Map();
    for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
      const key = formatDateKey(cursor);
      dailyMap.set(key, {
        date: key,
        label: formatLabel(cursor),
        events: 0,
        stories: 0,
        views: 0,
        saves: 0,
        messages: 0,
        pitches: 0,
        scripts_generated: 0,
        profile_views: 0,
        follows: 0,
      });
    }

    for (const event of relevantEvents) {
      const key = formatDateKey(new Date(event.timestamp));
      const bucket = dailyMap.get(key);
      if (!bucket) continue;
      bucket.events += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.STORY_CREATED && event.user_id === userId) bucket.stories += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_VIEW) bucket.views += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_SAVE) bucket.saves += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.MESSAGE_SENT && event.user_id === userId) bucket.messages += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.PITCH_SENT && event.user_id === userId) bucket.pitches += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_GENERATED && event.user_id === userId) bucket.scripts_generated += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.PROFILE_VIEW && event.user_id === userId) bucket.profile_views += 1;
      if (event.event_type === ANALYTICS_EVENT_TYPES.FOLLOW_WRITER && event.user_id === userId) bucket.follows += 1;
    }
    const dailyActivity = [...dailyMap.values()];

    const genreCounts = new Map();
    for (const event of relevantEvents) {
      const genre = normalizeGenre(event.metadata?.genre);
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
    const totalGenreEvents = [...genreCounts.values()].reduce((sum, count) => sum + count, 0);
    const genreDistribution = [...genreCounts.entries()]
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: round(safeDivide(count, totalGenreEvents) * 100, 1),
      }))
      .sort((a, b) => b.count - a.count);

    const funnelStages = audience === ANALYTICS_AUDIENCES.PRODUCER
      ? [
          { key: "views", label: "Scripts Viewed", count: totalViews },
          { key: "saves", label: "Scripts Saved", count: scriptsSaved },
          { key: "messages", label: "Messages Sent", count: messagesSent },
          { key: "pitches", label: "Pitches Sent", count: pitchesSent },
          { key: "follows", label: "Writers Followed", count: followCount },
        ]
      : [
          { key: "stories", label: "Stories Created", count: getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.STORY_CREATED) },
          { key: "scripts", label: "Scripts Generated", count: getEventCount(actorEvents, ANALYTICS_EVENT_TYPES.SCRIPT_GENERATED) },
          { key: "views", label: "Script Views", count: totalViews },
          { key: "messages", label: "Messages", count: messagesSent },
          { key: "pitches", label: "Pitches", count: pitchesSent },
        ];
    const funnelData = funnelStages.map((stage, index) => ({
      ...stage,
      conversion: index === 0 ? 100 : round(safeDivide(stage.count, funnelStages[index - 1].count) * 100, 1),
    }));

    const scriptScoreMap = new Map();
    const storyViewMap = new Map();
    for (const event of relevantEvents) {
      if (event.script_id) {
        const current = scriptScoreMap.get(event.script_id) || { views: 0, saves: 0, pitches: 0, messages: 0, score: 0 };
        if (event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_VIEW) current.views += 1;
        if (event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_SAVE) current.saves += 1;
        if (event.event_type === ANALYTICS_EVENT_TYPES.PITCH_SENT) current.pitches += 1;
        if (event.event_type === ANALYTICS_EVENT_TYPES.MESSAGE_SENT) current.messages += 1;
        current.score = current.views + current.saves * 3 + current.messages * 2 + current.pitches * 4;
        scriptScoreMap.set(event.script_id, current);
      }

      if (event.story_id && event.event_type === ANALYTICS_EVENT_TYPES.SCRIPT_VIEW) {
        storyViewMap.set(event.story_id, (storyViewMap.get(event.story_id) || 0) + 1);
      }
    }

    const topScriptEntry = [...scriptScoreMap.entries()].sort((a, b) => b[1].score - a[1].score)[0] || null;
    const topStoryEntry = [...storyViewMap.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const [scriptTitleMap, storyTitleMap] = await Promise.all([
      fetchTitlesByIds(this.db.collection("scripts"), topScriptEntry ? [topScriptEntry[0]] : [], "_id", "title"),
      fetchTitlesByIds(this.db.collection("stories"), topStoryEntry ? [topStoryEntry[0]] : [], "_id", "title"),
    ]);

    const mostActiveDay = [...dailyActivity].sort((a, b) => b.events - a.events)[0] || null;
    const { averageSessionActivity, sessionCount } = calculateSessions(relevantEvents, userId);

    const storySuccessScore = Math.max(
      0,
      Math.min(100, Math.round(totalViews * 4 + scriptsSaved * 9 + messagesSent * 6 + pitchesSent * 12)),
    );
    const pitchReadinessMeter = Math.max(
      0,
      Math.min(100, Math.round(safeDivide((scriptsGenerated * 15) + (pitchesSent * 25) + (scriptsSaved * 8), Math.max(1, resolvedDays / 7)))),
    );

    return {
      audience,
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: resolvedDays,
      },
      summary: {
        total_views: totalViews,
        scripts_saved: scriptsSaved,
        messages_sent: messagesSent,
        pitches_sent: pitchesSent,
        scripts_generated: scriptsGenerated,
        growth_percentage: growthPercentage,
        profile_views: profileViews,
        followers: followCount,
        story_success_score: storySuccessScore,
        pitch_readiness_meter: pitchReadinessMeter,
      },
      daily_activity: dailyActivity,
      genre_distribution: genreDistribution,
      funnel_data: funnelData,
      top_content: {
        best_performing_script: topScriptEntry
          ? {
              script_id: topScriptEntry[0],
              title: scriptTitleMap.get(topScriptEntry[0]) || relevantEvents.find((event) => event.script_id === topScriptEntry[0])?.metadata?.script_title || "Untitled Script",
              ...topScriptEntry[1],
            }
          : null,
        most_viewed_story: topStoryEntry
          ? {
              story_id: topStoryEntry[0],
              title: storyTitleMap.get(topStoryEntry[0]) || relevantEvents.find((event) => event.story_id === topStoryEntry[0])?.metadata?.story_title || "Untitled Story",
              views: topStoryEntry[1],
            }
          : null,
      },
      user_behavior: {
        most_active_day: mostActiveDay?.label || null,
        average_session_activity: averageSessionActivity,
        active_days: dailyActivity.filter((item) => item.events > 0).length,
        session_count: sessionCount,
      },
      event_mix: [
        { key: "views", label: "Views", count: totalViews },
        { key: "saves", label: "Saves", count: scriptsSaved },
        { key: "messages", label: "Messages", count: messagesSent },
        { key: "pitches", label: "Pitches", count: pitchesSent },
        { key: "scripts_generated", label: "Scripts Generated", count: scriptsGenerated },
      ],
    };
  }

  async getInsights(options) {
    const analytics = await this.getAnalytics(options);
    const { summary, genre_distribution: genreDistribution, user_behavior: userBehavior } = analytics;
    const bestGenre = genreDistribution[0]?.genre || null;
    const trendDirection = inferTrendDirection(summary.growth_percentage);
    const highlights = [];
    const recommendations = [];

    if (trendDirection === "up") {
      highlights.push(`Your visibility is growing, with activity up ${summary.growth_percentage}% over the previous week.`);
    } else if (trendDirection === "down") {
      highlights.push(`Your activity dropped ${Math.abs(summary.growth_percentage)}% compared with the previous week.`);
    } else {
      highlights.push("Your activity is steady. Consistency is good, but another push could unlock more momentum.");
    }

    if (bestGenre) {
      highlights.push(`${bestGenre} is your best performing genre right now.`);
    }

    if (summary.scripts_saved <= Math.max(1, Math.round(summary.total_views * 0.08))) {
      recommendations.push("Save intent is low compared with views. Tighten your hook, logline, and first impression.");
    }

    if (summary.total_views === 0) {
      recommendations.push("You have not generated enough discovery yet. Explore scripts, share your profile, or publish a script teaser.");
    }

    if (summary.messages_sent === 0 && summary.total_views > 0) {
      recommendations.push("People are viewing your content, but conversations are not starting. Add clearer call-to-action moments.");
    }

    if (summary.pitches_sent === 0 && summary.scripts_generated > 0) {
      recommendations.push("You have scripts ready. Start sending curated pitches to move from creation to opportunity.");
    }

    if (userBehavior.average_session_activity >= 4) {
      highlights.push(`You engage deeply once you log in, averaging ${userBehavior.average_session_activity} actions per session.`);
    } else if (userBehavior.average_session_activity > 0) {
      recommendations.push("Your sessions are brief. Focus on one high-value action each visit, like following a writer or sending a pitch.");
    }

    if (userBehavior.most_active_day) {
      highlights.push(`${userBehavior.most_active_day} is currently your strongest activity day.`);
    }

    if (!recommendations.length) {
      recommendations.push("Keep doubling down on the formats and genres already bringing you attention.");
    }

    return {
      generated_at: new Date().toISOString(),
      best_performing_genre: bestGenre,
      activity_trend: trendDirection,
      user_engagement_behavior: userBehavior.average_session_activity >= 4
        ? "high-intent sessions"
        : userBehavior.average_session_activity > 0
          ? "light but consistent engagement"
          : "inactive",
      highlights,
      recommendations,
    };
  }
}
