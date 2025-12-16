"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Chip } from "@/components/shared/Chip";
import { Connection, DailyBrief, SpaceBetweenReport } from "@/types";
import { ArrowLeft, ChevronDown, Link2, Unlink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Simple accordion for Space Between sections
function SpaceAccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-accent-muted">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-accent-gold transition-colors"
      >
        <span className="font-medium text-accent-ink">{title}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-accent-ink/60 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="pb-6 text-accent-ink/70 text-sm leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  // Connection state
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily Brief state
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Space Between state
  const [spaceBetween, setSpaceBetween] = useState<SpaceBetweenReport | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Load connection data
  useEffect(() => {
    loadConnection();
  }, [connectionId]);

  const loadConnection = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/connections");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load connections");
      }

      const found = data.connections?.find((c: Connection) => c.id === connectionId);
      if (!found) {
        throw new Error("Connection not found");
      }

      setConnection(found);
      setNotes(found.notes || "");
    } catch (err: any) {
      console.error("Error loading connection:", err);
      setError(err.message || "Unable to load connection");
    } finally {
      setLoading(false);
    }
  };

  // Load Daily Brief (on-demand)
  const loadDailyBrief = useCallback(async () => {
    if (!connectionId || briefLoading) return;

    try {
      setBriefLoading(true);
      setBriefError(null);

      const response = await fetch("/api/connection-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load daily brief");
      }

      setDailyBrief(data);
    } catch (err: any) {
      console.error("Error loading daily brief:", err);
      setBriefError(err.message || "Unable to load today's brief");
    } finally {
      setBriefLoading(false);
    }
  }, [connectionId, briefLoading]);

  // Load Space Between (stone tablet)
  const loadSpaceBetween = useCallback(async () => {
    if (!connectionId || spaceLoading) return;

    try {
      setSpaceLoading(true);
      setSpaceError(null);

      const response = await fetch("/api/connection-space-between", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load Space Between");
      }

      setSpaceBetween(data);
    } catch (err: any) {
      console.error("Error loading Space Between:", err);
      setSpaceError(err.message || "Unable to load relationship blueprint");
    } finally {
      setSpaceLoading(false);
    }
  }, [connectionId, spaceLoading]);

  // Save notes
  const saveNotes = async () => {
    if (!connectionId) return;

    try {
      setNotesSaving(true);

      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectionId, notes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save notes");
      }

      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err: any) {
      console.error("Error saving notes:", err);
      alert(err.message || "Unable to save notes");
    } finally {
      setNotesSaving(false);
    }
  };

  // Delete connection
  const handleDelete = async () => {
    if (!confirm(`Delete ${connection?.name}? This cannot be undone.`)) return;

    try {
      const response = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete connection");
      }

      router.push("/sanctuary/connections");
    } catch (err: any) {
      console.error("Error deleting connection:", err);
      alert(err.message || "Unable to delete connection");
    }
  };

  // Load brief when Today tab is first viewed
  const handleTabChange = (value: string) => {
    if (value === "today" && !dailyBrief && !briefLoading && !briefError) {
      loadDailyBrief();
    }
    if (value === "space" && !spaceBetween && !spaceLoading && !spaceError) {
      loadSpaceBetween();
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
        </div>
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/sanctuary/connections"
          className="inline-flex items-center gap-2 text-sm text-accent-ink/60 hover:text-accent-gold transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Connections
        </Link>
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-5xl mb-4">😔</p>
            <p className="text-red-600 mb-4">{error || "Connection not found"}</p>
            <Button variant="outline" onClick={() => router.push("/sanctuary/connections")}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
      {/* Back link */}
      <Link
        href="/sanctuary/connections"
        className="inline-flex items-center gap-2 text-sm text-accent-ink/60 hover:text-accent-gold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Connections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{connection.name}</h1>
          <div className="flex items-center gap-3">
            <Chip className="text-xs">{connection.relationship_type}</Chip>
            {connection.linked_profile_id ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Link2 className="h-3 w-3" />
                Linked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-accent-ink/50 bg-accent-muted/50 px-2 py-1 rounded-full">
                <Unlink className="h-3 w-3" />
                Unlinked
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-700">
          Delete
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="space">Space Between</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Today Tab - Daily Brief */}
        <TabsContent value="today">
          <Card className="mt-4">
            <CardContent className="p-6">
              {briefLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
                  <p className="text-sm text-accent-ink/60">Generating today&apos;s brief...</p>
                </div>
              ) : briefError ? (
                <div className="text-center py-12">
                  <p className="text-5xl mb-4">😔</p>
                  <p className="text-red-600 mb-4">{briefError}</p>
                  <Button variant="outline" onClick={loadDailyBrief}>
                    Try again
                  </Button>
                </div>
              ) : dailyBrief ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-accent-gold mb-3">
                      {dailyBrief.title}
                    </h2>
                    <p className="text-accent-ink/80 leading-relaxed">
                      {dailyBrief.shared_vibe}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-ink/60 mb-3">
                      Ways to show up
                    </h3>
                    <ul className="space-y-2">
                      {dailyBrief.ways_to_show_up.map((way, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-accent-gold mt-0.5">→</span>
                          <span className="text-accent-ink/80">{way}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {dailyBrief.nudge && (
                    <div className="bg-accent-muted/30 rounded-lg p-4">
                      <p className="text-sm text-accent-ink/70 italic">
                        {dailyBrief.nudge}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-4">✨</p>
                  <p className="text-accent-ink/60 mb-4">
                    Generate today&apos;s connection brief
                  </p>
                  <Button variant="gold" onClick={loadDailyBrief}>
                    Generate brief
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Space Between Tab - Stone Tablet */}
        <TabsContent value="space">
          <Card className="mt-4">
            <CardContent className="p-6">
              {spaceLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
                  <p className="text-sm text-accent-ink/60">
                    Generating your relationship blueprint...
                  </p>
                  <p className="text-xs text-accent-ink/40 mt-2">
                    This may take a moment
                  </p>
                </div>
              ) : spaceError ? (
                <div className="text-center py-12">
                  <p className="text-5xl mb-4">😔</p>
                  <p className="text-red-600 mb-4">{spaceError}</p>
                  <Button variant="outline" onClick={loadSpaceBetween}>
                    Try again
                  </Button>
                </div>
              ) : spaceBetween ? (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-accent-gold mb-2">
                      The Space Between
                    </h2>
                    <p className="text-sm text-accent-ink/60">
                      Your relationship blueprint with {connection.name}
                    </p>
                    {spaceBetween.includes_linked_birth_data && (
                      <p className="text-xs text-green-600 mt-1">
                        Includes {connection.name}&apos;s verified birth data
                      </p>
                    )}
                  </div>

                  <div className="space-y-0">
                    <SpaceAccordionItem title="Essence" defaultOpen={true}>
                      {spaceBetween.relationship_essence}
                    </SpaceAccordionItem>
                    <SpaceAccordionItem title="Emotional Blueprint">
                      {spaceBetween.emotional_blueprint}
                    </SpaceAccordionItem>
                    <SpaceAccordionItem title="Communication">
                      {spaceBetween.communication_patterns}
                    </SpaceAccordionItem>
                    <SpaceAccordionItem title="Growth Edges">
                      {spaceBetween.growth_edges}
                    </SpaceAccordionItem>
                    <SpaceAccordionItem title="Care Guide">
                      {spaceBetween.care_guide}
                    </SpaceAccordionItem>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-5xl mb-4">🌌</p>
                  <h3 className="text-lg font-semibold mb-2">
                    Discover the Space Between
                  </h3>
                  <p className="text-accent-ink/60 mb-6 max-w-md mx-auto">
                    Generate your permanent relationship blueprint with {connection.name}.
                    This deep insight is created once and saved forever.
                  </p>
                  <Button variant="gold" onClick={loadSpaceBetween}>
                    Generate blueprint
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-ink/60 mb-3">
                    Your private notes about {connection.name}
                  </h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={`Add notes about ${connection.name}...`}
                    className="w-full h-48 p-4 border border-accent-muted rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-accent-ink"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-accent-ink/50">
                    Notes are private and only visible to you
                  </p>
                  <div className="flex items-center gap-3">
                    {notesSaved && (
                      <span className="text-sm text-green-600">Saved!</span>
                    )}
                    <Button
                      variant="gold"
                      onClick={saveNotes}
                      disabled={notesSaving}
                    >
                      {notesSaving ? "Saving..." : "Save notes"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
