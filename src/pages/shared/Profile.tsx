import { useEffect, useState } from "react";
import { Award, Bell, Eye, FileText, Save, Shield, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import WriterProfileStudio from "@/components/writer-profile/WriterProfileStudio";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

interface ProfileData {
  id: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string | null;
  preferences: Record<string, unknown> | null;
}

const Profile = () => {
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    profile_public: true,
    message_alerts: true,
  });
  const [stats, setStats] = useState({
    scriptsUploaded: 0,
    totalViews: 0,
    achievements: 0,
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await mongodbClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const resolvedRole = roleData?.role || "writer";
      setUserRole(resolvedRole);

      const { data: profileData } = await mongodbClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (profileData) {
        const typedProfile = profileData as ProfileData;
        setProfile(typedProfile);
        const prefs = typedProfile.preferences || {};
        setPreferences({
          email_notifications: Boolean(prefs.email_notifications ?? true),
          profile_public: Boolean(prefs.profile_public ?? true),
          message_alerts: Boolean(prefs.message_alerts ?? true),
        });
      }

      const scriptsResponse = await mongodbClient.scripts.listMine();
      const storyCountResponse = await mongodbClient.from("stories").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const scripts = scriptsResponse.data || [];
      const writerProfile = (profileData as ProfileData | null)?.preferences?.writer_profile as { profile?: { achievements?: string[] } } | undefined;

      setStats({
        scriptsUploaded: scripts.length,
        totalViews: scripts.reduce((sum, script) => sum + (script.views || 0), 0),
        achievements: writerProfile?.profile?.achievements?.length || ((storyCountResponse.count || 0) > 0 ? 1 : 0),
      });
      await trackEvent({
        event_type: "PROFILE_VIEW",
        metadata: {
          profile_owner_id: user.id,
          profile_name: profileData?.name || null,
          role: resolvedRole,
        },
      });
      setLoading(false);
    };

    void loadProfile();
  }, []);

  const handleSavePreferences = async () => {
    if (!profile) return;
    setSaving(true);
    const nextPreferences = {
      ...(profile.preferences || {}),
      ...preferences,
    };

    const { error } = await mongodbClient
      .from("profiles")
      .update({
        preferences: nextPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      toast({ title: "Save failed", description: error.message || "Please try again.", variant: "destructive" });
    } else {
      setProfile({ ...profile, preferences: nextPreferences });
      toast({ title: "Preferences updated" });
    }
    setSaving(false);
  };

  if (loading) {
    const loader = (
      <div className="p-8">
        <Card className="glass p-10 text-center text-muted-foreground">Loading profile...</Card>
      </div>
    );
    return userRole === "producer" ? <ProducerLayout>{loader}</ProducerLayout> : <WriterLayout>{loader}</WriterLayout>;
  }

  if (!profile) {
    const empty = (
      <div className="p-8">
        <Card className="glass p-10 text-center text-muted-foreground">Profile not available.</Card>
      </div>
    );
    return userRole === "producer" ? <ProducerLayout>{empty}</ProducerLayout> : <WriterLayout>{empty}</WriterLayout>;
  }

  if (userRole === "writer") {
    return (
      <WriterLayout>
        <WriterProfileStudio
          profileId={profile.id}
          initialName={profile.name || ""}
          initialBio={profile.bio || ""}
          initialAvatarUrl={profile.avatar_url || ""}
          initialPreferences={profile.preferences || {}}
        />
      </WriterLayout>
    );
  }

  return (
    <ProducerLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="glass p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{profile.name || "PitchRoom Member"}</h1>
                  <Badge variant="secondary" className="capitalize">{userRole}</Badge>
                </div>
                <p className="mt-3 max-w-2xl text-muted-foreground">{profile.bio || "Update your profile details from onboarding."}</p>
              </div>
              <Button onClick={handleSavePreferences} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Scripts", value: stats.scriptsUploaded, icon: FileText },
              { label: "Views", value: stats.totalViews, icon: Eye },
              { label: "Achievements", value: stats.achievements, icon: Award },
            ].map((item) => (
              <Card key={item.label} className="glass p-6 text-center">
                <item.icon className="mx-auto mb-3 h-6 w-6 text-primary" />
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Privacy</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Public profile</p>
                    <p className="text-xs text-muted-foreground">Show your producer profile to others.</p>
                  </div>
                  <Switch checked={preferences.profile_public} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, profile_public: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Message alerts</p>
                    <p className="text-xs text-muted-foreground">Receive notifications for new conversations.</p>
                  </div>
                  <Switch checked={preferences.message_alerts} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, message_alerts: checked }))} />
                </div>
              </div>
            </Card>

            <Card className="glass p-6">
              <div className="mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Email notifications</p>
                    <p className="text-xs text-muted-foreground">Get important activity recaps in your inbox.</p>
                  </div>
                  <Switch checked={preferences.email_notifications} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, email_notifications: checked }))} />
                </div>
                <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  Producer profile editing remains lightweight here while the full customizable studio is reserved for writer portfolios.
                </div>
              </div>
            </Card>
          </div>

          <Card className="glass p-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Account Snapshot</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Route: `/profile`. Role-aware profile rendering is active, so writers see the full portfolio studio while producers keep a focused settings view.
            </p>
          </Card>
        </div>
      </div>
    </ProducerLayout>
  );
};

export default Profile;
