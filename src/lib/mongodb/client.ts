const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4002/api";
const TOKEN_KEY = "pitchroom-auth-token";
const USER_KEY = "pitchroom-auth-user";

export interface AuthUser {
  id: string;
  email: string;
  is_verified?: boolean;
}

export interface ScriptAuthor {
  id: string | null;
  name: string;
}

export interface ScriptRecord {
  id: string;
  _id: string;
  userId?: string;
  writer_id?: string;
  sourceStoryId?: string;
  title: string;
  logline: string;
  genre?: string | null;
  scriptContent?: string;
  visibility: "private" | "public";
  createdAt?: string;
  created_at?: string;
  author?: ScriptAuthor;
  status?: string;
  views?: number;
}

export type AnalyticsEventType =
  | "STORY_CREATED"
  | "SCRIPT_GENERATED"
  | "SCRIPT_VIEW"
  | "SCRIPT_SAVE"
  | "MESSAGE_SENT"
  | "PITCH_SENT"
  | "PROFILE_VIEW"
  | "FOLLOW_WRITER";

type AuthListener = (event: string, session: { user: AuthUser } | null) => void | Promise<void>;

const listeners = new Set<AuthListener>();

const readToken = () => localStorage.getItem(TOKEN_KEY);
const readUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

const writeSession = (token?: string | null, user?: AuthUser | null) => {
  if (token && user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

const notifyAuth = (event: string) => {
  const user = readUser();
  const session = user ? { user } : null;
  listeners.forEach((listener) => listener(event, session));
};

const request = async (path: string, init: RequestInit = {}) => {
  const token = readToken();
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (response.status === 401 && token) {
    writeSession(null, null);
    notifyAuth("SIGNED_OUT");
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        message: payload?.error || "Request failed",
        status: response.status,
        code: payload?.code || null,
        reason: payload?.reason || null,
      },
    };
  }

  return { data: payload, error: null };
};

type FilterOp = {
  field: string;
  operator: "eq" | "neq" | "in" | "gte" | "not";
  value: unknown;
  comparator?: string;
};

class QueryBuilder {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  selectClause = "*";
  selectOptions: Record<string, unknown> = {};
  filters: FilterOp[] = [];
  orFilters: Array<{ field: string; operator: "eq"; value: string }> = [];
  orderBy?: { column: string; ascending?: boolean };
  limitBy?: number;
  payload: unknown = null;
  wantsSingle = false;
  wantsMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
    this.action = "select";
  }

  select(columns = "*", options: Record<string, unknown> = {}) {
    this.selectClause = columns;
    this.selectOptions = options;
    return this;
  }

  insert(values: unknown) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.action = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  upsert(values: unknown) {
    this.action = "upsert";
    this.payload = values;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: "eq", value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, operator: "neq", value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, operator: "in", value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, operator: "gte", value });
    return this;
  }

  not(field: string, comparator: string, value: unknown) {
    this.filters.push({ field, operator: "not", comparator, value });
    return this;
  }

  or(expression: string) {
    const clauses = expression.split(",").map((part) => part.trim()).filter(Boolean);
    this.orFilters = clauses
      .map((clause) => {
        const [field, operator, ...rest] = clause.split(".");
        if (operator !== "eq") return null;
        return { field, operator: "eq" as const, value: rest.join(".") };
      })
      .filter(Boolean) as Array<{ field: string; operator: "eq"; value: string }>;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending };
    return this;
  }

  limit(value: number) {
    this.limitBy = value;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  async execute() {
    if (this.action === "select") {
      const result = await request(`/db/${this.table}/query`, {
        method: "POST",
        body: JSON.stringify({
          filters: this.filters,
          orFilters: this.orFilters,
          select: this.selectClause,
          order: this.orderBy,
          limit: this.limitBy,
          single: this.wantsSingle,
          maybeSingle: this.wantsMaybeSingle,
          count: this.selectOptions.count,
          head: this.selectOptions.head,
        }),
      });

      if (result.error) return { data: null, error: result.error, count: null };
      return {
        data: result.data.data,
        error: result.data.error,
        count: result.data.count ?? null,
      };
    }

    if (this.action === "insert") {
      const result = await request(`/db/${this.table}/insert`, {
        method: "POST",
        body: JSON.stringify({ values: this.payload }),
      });
      if (result.error) return { data: null, error: result.error };
      const rows = Array.isArray(result.data.data) ? result.data.data : [result.data.data].filter(Boolean);
      return { data: this.wantsSingle || this.wantsMaybeSingle ? rows[0] ?? null : rows, error: null };
    }

    if (this.action === "update") {
      const result = await request(`/db/${this.table}/update`, {
        method: "PATCH",
        body: JSON.stringify({ values: this.payload, filters: this.filters, orFilters: this.orFilters }),
      });
      if (result.error) return { data: null, error: result.error };
      const rows = Array.isArray(result.data.data) ? result.data.data : [result.data.data].filter(Boolean);
      return { data: this.wantsSingle || this.wantsMaybeSingle ? rows[0] ?? null : rows, error: null };
    }

    if (this.action === "delete") {
      const result = await request(`/db/${this.table}/delete`, {
        method: "DELETE",
        body: JSON.stringify({ filters: this.filters, orFilters: this.orFilters }),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: [], error: null };
    }

    const result = await request(`/db/${this.table}/upsert`, {
      method: "POST",
      body: JSON.stringify({ values: this.payload }),
    });
    if (result.error) return { data: null, error: result.error };
    return { data: result.data.data, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const createChannel = () => ({
  on() {
    return this;
  },
  subscribe() {
    return this;
  },
});

export const mongodbClient = {
  auth: {
    async getSession() {
      const user = readUser();
      return { data: { session: user ? { user, access_token: readToken() } : null }, error: null };
    },
    async getUser() {
      const user = readUser();
      if (!user) return { data: { user: null }, error: null };

      const result = await request("/auth/me", { method: "GET" });
      if (result.error) {
        writeSession(null, null);
        notifyAuth("SIGNED_OUT");
        return { data: { user: null }, error: result.error };
      }
      return { data: { user: result.data.user }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.error) return { data: { user: null, session: null }, error: result.error };

      writeSession(result.data.session.access_token, result.data.user);
      notifyAuth("SIGNED_IN");
      return { data: result.data, error: null };
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { name?: string } } }) {
      const result = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name: options?.data?.name }),
      });
      if (result.error) return { data: { user: null, session: null }, error: result.error };

      writeSession(result.data.session?.access_token, result.data.user);
      notifyAuth("SIGNED_IN");
      return { data: result.data, error: null };
    },
    async resendVerificationEmail(email: string) {
      const result = await request("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data, error: null };
    },
    async signOut() {
      writeSession(null, null);
      notifyAuth("SIGNED_OUT");
      return { error: null };
    },
    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  },
  from(table: string) {
    return new QueryBuilder(table);
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(storagePath: string, file: File | Blob, _options?: { upsert?: boolean }) {
          const formData = new FormData();
          const requestedFileName = storagePath.split("/").filter(Boolean).pop() || "upload.bin";
          const normalizedFile = file instanceof File ? file : new File([file], requestedFileName);
          formData.append("file", normalizedFile);
          formData.append("path", storagePath);
          const result = await request(`/storage/${bucket}/upload`, { method: "POST", body: formData });
          if (result.error) return { data: null, error: result.error };
          return { data: result.data, error: null };
        },
        getPublicUrl(storagePath: string) {
          const [, fileId] = storagePath.split("/");
          return {
            data: {
              publicUrl: fileId
                ? `${API_URL}/storage/${bucket}/file/${fileId}`
                : `${API_URL}/storage/${bucket}/download?path=${encodeURIComponent(storagePath)}`,
            },
          };
        },
        async download(storagePath: string) {
          const token = readToken();
          const headers = new Headers();
          if (token) headers.set("Authorization", `Bearer ${token}`);
          const targetUrl = /^https?:\/\//i.test(storagePath)
            ? storagePath
            : `${API_URL}/storage/${bucket}/download?path=${encodeURIComponent(storagePath)}`;
          const response = await fetch(targetUrl, { headers });
          if (!response.ok) return { data: null, error: { message: "Download failed" } };
          return { data: await response.blob(), error: null };
        },
      };
    },
  },
  functions: {
    async invoke(name: string, options: { body?: unknown } = {}) {
      const result = await request(`/functions/${name}`, {
        method: "POST",
        body: JSON.stringify(options.body ?? {}),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data, error: result.data.error ? { message: result.data.error } : null };
    },
  },
  channel() {
    return createChannel();
  },
  removeChannel() {
    return null;
  },
  analytics: {
    async track(event: {
      event_type: AnalyticsEventType;
      user_id?: string;
      script_id?: string | null;
      story_id?: string | null;
      metadata?: Record<string, unknown>;
      timestamp?: string;
    }) {
      const result = await request("/track", {
        method: "POST",
        body: JSON.stringify(event),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data, error: null };
    },
    async getAnalytics(params: {
      audience: "writer" | "producer";
      days?: number;
      start?: string;
      end?: string;
    }) {
      const search = new URLSearchParams();
      search.set("audience", params.audience);
      if (params.days) search.set("days", String(params.days));
      if (params.start) search.set("start", params.start);
      if (params.end) search.set("end", params.end);
      const result = await request(`/analytics?${search.toString()}`, { method: "GET" });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data, error: null };
    },
    async getInsights(params: {
      audience: "writer" | "producer";
      days?: number;
      start?: string;
      end?: string;
    }) {
      const search = new URLSearchParams();
      search.set("audience", params.audience);
      if (params.days) search.set("days", String(params.days));
      if (params.start) search.set("start", params.start);
      if (params.end) search.set("end", params.end);
      const result = await request(`/insights?${search.toString()}`, { method: "GET" });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data, error: null };
    },
    async seedDemo(audience: "writer" | "producer") {
      const result = await request("/analytics/seed-demo", {
        method: "POST",
        body: JSON.stringify({ audience }),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data, error: null };
    },
  },
  scripts: {
    async create(payload: {
      title: string;
      logline: string;
      scriptContent: string;
      genre?: string;
      visibility?: "private" | "public";
      sourceStoryId?: string;
    }) {
      const result = await request("/scripts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data as ScriptRecord, error: null };
    },
    async listPublic() {
      const result = await request("/scripts/public", { method: "GET" });
      if (result.error) return { data: null, error: result.error };
      return { data: (result.data.data || []) as ScriptRecord[], error: null };
    },
    async listMine() {
      const result = await request("/scripts/my", { method: "GET" });
      if (result.error) return { data: null, error: result.error };
      return { data: (result.data.data || []) as ScriptRecord[], error: null };
    },
    async getById(id: string) {
      const result = await request(`/scripts/${id}`, { method: "GET" });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data as ScriptRecord, error: null };
    },
    async updateVisibility(id: string, visibility: "private" | "public") {
      const result = await request(`/scripts/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data as ScriptRecord, error: null };
    },
    async delete(id: string) {
      const result = await request(`/scripts/${id}`, { method: "DELETE" });
      if (result.error) return { data: null, error: result.error };
      return { data: result.data.data as { id: string }, error: null };
    },
  },
};
