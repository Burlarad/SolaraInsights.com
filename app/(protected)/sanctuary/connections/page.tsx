"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SpaceBetweenSheet } from "@/components/sanctuary/SpaceBetweenSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/Chip";
import { Connection, DailyBrief } from "@/types";
import { formatDateForDisplay } from "@/lib/datetime";
import {
  Link2,
  Unlink,
  ChevronDown,
  Loader2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Extended type with brief preview and full brief
interface ConnectionWithPreview extends Connection {
  todayBrief?: {
    title: string;
    shared_vibe: string;
  } | null;
  fullBrief?: DailyBrief | null;
}

// Truncate text to specified length
function truncateText(text: string, maxLength: number = 140): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

const RELATIONSHIP_TYPES = [
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Friend",
  "Colleague",
  "Other",
];

export default function ConnectionsPage() {
  // Connections list state
  const [connections, setConnections] = useState<ConnectionWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Edit mode state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    relationship_type: "",
    birth_date: "",
    birth_time: "",
    birth_city: "",
    birth_region: "",
    birth_country: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Notes state
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [notesSavedId, setNotesSavedId] = useState<string | null>(null);

  // Brief loading state (per connection)
  const [loadingBriefIds, setLoadingBriefIds] = useState<Set<string>>(new Set());

  // Space Between sheet state
  const [spaceSheetOpen, setSpaceSheetOpen] = useState(false);
  const [spaceSheetConnectionId, setSpaceSheetConnectionId] = useState("");
  const [spaceSheetConnectionName, setSpaceSheetConnectionName] = useState("");

  // Add connection form state
  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState("Partner");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [birthRegion, setBirthRegion] = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  // Refs for IntersectionObserver
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Setup IntersectionObserver for lazy brief generation
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const connectionId = entry.target.getAttribute("data-connection-id");
            if (connectionId) {
              const connection = connections.find((c) => c.id === connectionId);
              if (connection && !connection.todayBrief && !loadingBriefIds.has(connectionId)) {
                generateBriefForConnection(connectionId);
              }
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all cards
    cardRefs.current.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [connections, loadingBriefIds]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/connections");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load connections");
      }

      const loadedConnections = data.connections || [];
      setConnections(loadedConnections);

      // Initialize notes map
      const notes: Record<string, string> = {};
      loadedConnections.forEach((c: Connection) => {
        notes[c.id] = c.notes || "";
      });
      setNotesMap(notes);
    } catch (err: any) {
      console.error("Error loading connections:", err);
      setError(err.message || "Unable to load connections. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateBriefForConnection = useCallback(
    async (connectionId: string) => {
      if (loadingBriefIds.has(connectionId)) return;

      setLoadingBriefIds((prev) => new Set(prev).add(connectionId));

      try {
        const response = await fetch("/api/connection-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        });

        const data = await response.json();

        if (response.ok) {
          // Update connection with full brief
          setConnections((prev) =>
            prev.map((c) =>
              c.id === connectionId
                ? {
                    ...c,
                    todayBrief: {
                      title: data.title,
                      shared_vibe: data.shared_vibe,
                    },
                    fullBrief: data,
                  }
                : c
            )
          );
        }
      } catch (err) {
        console.error("Error generating brief:", err);
      } finally {
        setLoadingBriefIds((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      }
    },
    [loadingBriefIds]
  );

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsAddingConnection(true);
      setAddError(null);

      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relationship_type: relationshipType,
          birth_date: birthDate || null,
          birth_time: unknownBirthTime ? null : birthTime || null,
          birth_city: birthCity || null,
          birth_region: birthRegion || null,
          birth_country: birthCountry || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add connection");
      }

      // Add new connection to list
      const newConnection = { ...data.connection, todayBrief: null, fullBrief: null };
      setConnections([...connections, newConnection]);
      setNotesMap((prev) => ({ ...prev, [newConnection.id]: "" }));

      // Clear form
      setName("");
      setRelationshipType("Partner");
      setBirthDate("");
      setBirthTime("");
      setBirthCity("");
      setBirthRegion("");
      setBirthCountry("");
      setUnknownBirthTime(false);

      // Show saved message
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err: any) {
      console.error("Error adding connection:", err);
      setAddError(err.message || "Unable to add connection. Please try again.");
    } finally {
      setIsAddingConnection(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Delete this connection? This cannot be undone.")) {
      return;
    }

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

      setConnections(connections.filter((c) => c.id !== connectionId));
      if (expandedCardId === connectionId) setExpandedCardId(null);
      if (editingCardId === connectionId) setEditingCardId(null);
    } catch (err: any) {
      console.error("Error deleting connection:", err);
      alert(err.message || "Unable to delete connection. Please try again.");
    }
  };

  const toggleExpand = (connectionId: string) => {
    if (expandedCardId === connectionId) {
      setExpandedCardId(null);
      setEditingCardId(null);
    } else {
      setExpandedCardId(connectionId);
      setEditingCardId(null);

      // Generate brief if not exists
      const connection = connections.find((c) => c.id === connectionId);
      if (connection && !connection.todayBrief && !loadingBriefIds.has(connectionId)) {
        generateBriefForConnection(connectionId);
      }
    }
  };

  const startEditing = (connection: ConnectionWithPreview, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(connection.id);
    setEditForm({
      name: connection.name,
      relationship_type: connection.relationship_type,
      birth_date: connection.birth_date || "",
      birth_time: connection.birth_time || "",
      birth_city: connection.birth_city || "",
      birth_region: connection.birth_region || "",
      birth_country: connection.birth_country || "",
    });
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(null);
  };

  const saveEditing = async (connectionId: string, isLinked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setIsSavingEdit(true);

      const updatePayload: Record<string, unknown> = {
        id: connectionId,
        name: editForm.name,
        relationship_type: editForm.relationship_type,
      };

      // Only include birth fields if not linked
      if (!isLinked) {
        updatePayload.birth_date = editForm.birth_date || null;
        updatePayload.birth_time = editForm.birth_time || null;
        updatePayload.birth_city = editForm.birth_city || null;
        updatePayload.birth_region = editForm.birth_region || null;
        updatePayload.birth_country = editForm.birth_country || null;
      }

      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update connection");
      }

      // Update local state
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, ...data.connection } : c
        )
      );
      setEditingCardId(null);
    } catch (err: any) {
      console.error("Error updating connection:", err);
      alert(err.message || "Unable to update connection.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const saveNotes = async (connectionId: string) => {
    try {
      setSavingNotesId(connectionId);

      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectionId, notes: notesMap[connectionId] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save notes");
      }

      setNotesSavedId(connectionId);
      setTimeout(() => setNotesSavedId(null), 2000);
    } catch (err: any) {
      console.error("Error saving notes:", err);
      alert(err.message || "Unable to save notes");
    } finally {
      setSavingNotesId(null);
    }
  };

  const openSpaceBetween = (connection: ConnectionWithPreview, e: React.MouseEvent) => {
    e.stopPropagation();
    setSpaceSheetConnectionId(connection.id);
    setSpaceSheetConnectionName(connection.name);
    setSpaceSheetOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <SanctuaryTabs />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Connections</h1>
        <p className="text-accent-ink/60">
          Map the people in your orbit and explore relational insights
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Connection list */}
        <div className="lg:col-span-2 space-y-4">
          <p className="micro-label">YOUR CONNECTIONS</p>

          {loading ? (
            <Card className="text-center py-12">
              <CardContent>
                <Loader2 className="h-8 w-8 animate-spin text-accent-gold mx-auto mb-4" />
                <p className="text-accent-ink/60">Loading your connections...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="text-center py-12 border-red-200">
              <CardContent>
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={loadConnections}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : connections.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-accent-ink/60">
                  No connections yet. Add someone to begin exploring relational insights.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => {
                const isExpanded = expandedCardId === connection.id;
                const isEditing = editingCardId === connection.id;
                const isLinked = !!connection.linked_profile_id;
                const isLoadingBrief = loadingBriefIds.has(connection.id);

                return (
                  <Card
                    key={connection.id}
                    ref={(el) => {
                      if (el) {
                        cardRefs.current.set(connection.id, el);
                      } else {
                        cardRefs.current.delete(connection.id);
                      }
                    }}
                    data-connection-id={connection.id}
                    className={cn(
                      "transition-all",
                      isExpanded && "border-accent-gold/50 shadow-md"
                    )}
                  >
                    {/* Card Header - Always visible */}
                    <div
                      className="p-6 cursor-pointer"
                      onClick={() => toggleExpand(connection.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold">{connection.name}</h3>
                            {isLinked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                <Link2 className="h-3 w-3" />
                                Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-accent-ink/40 bg-accent-muted/50 px-2 py-0.5 rounded-full">
                                <Unlink className="h-3 w-3" />
                                Unlinked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Chip className="text-xs">{connection.relationship_type}</Chip>
                            {connection.birth_date && (
                              <span className="text-xs text-accent-ink/50">
                                Born {formatDateForDisplay(connection.birth_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-accent-ink/40 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                      </div>

                      {/* Mini preview - collapsed only */}
                      {!isExpanded && (
                        <div className="mt-3 pt-3 border-t border-accent-muted/50">
                          {isLoadingBrief ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                              <span className="text-sm text-accent-ink/50">
                                Generating today&apos;s brief...
                              </span>
                            </div>
                          ) : connection.todayBrief ? (
                            <p className="text-sm text-accent-ink/70 leading-relaxed">
                              {truncateText(connection.todayBrief.shared_vibe, 150)}
                            </p>
                          ) : (
                            <p className="text-sm text-accent-ink/50 italic">
                              Click to view today&apos;s brief
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <CardContent className="pt-0 pb-6 px-6 border-t border-accent-muted/50">
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mb-6 pt-4">
                          {!isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => startEditing(connection, e)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={(e) => openSpaceBetween(connection, e)}
                          >
                            Open Space Between
                          </Button>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteConnection(connection.id, e)}
                            className="text-accent-ink/40 hover:text-red-500"
                          >
                            Delete
                          </Button>
                        </div>

                        {/* Edit Mode */}
                        {isEditing ? (
                          <div className="space-y-4 bg-accent-muted/20 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Edit Connection</h4>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEditing}
                                  disabled={isSavingEdit}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="gold"
                                  size="sm"
                                  onClick={(e) => saveEditing(connection.id, isLinked, e)}
                                  disabled={isSavingEdit}
                                >
                                  {isSavingEdit ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                  value={editForm.name}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, name: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Relationship</Label>
                                <select
                                  value={editForm.relationship_type}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, relationship_type: e.target.value })
                                  }
                                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
                                >
                                  {RELATIONSHIP_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {isLinked ? (
                              <p className="text-xs text-accent-ink/50 italic">
                                Birth details are managed by the linked profile.
                              </p>
                            ) : (
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Birth Date</Label>
                                  <Input
                                    type="date"
                                    value={editForm.birth_date}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, birth_date: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Birth Time</Label>
                                  <Input
                                    type="time"
                                    value={editForm.birth_time}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, birth_time: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Birth City</Label>
                                  <Input
                                    value={editForm.birth_city}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, birth_city: e.target.value })
                                    }
                                    placeholder="e.g. Los Angeles"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Birth Region</Label>
                                  <Input
                                    value={editForm.birth_region}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, birth_region: e.target.value })
                                    }
                                    placeholder="e.g. California"
                                  />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                  <Label>Birth Country</Label>
                                  <Input
                                    value={editForm.birth_country}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, birth_country: e.target.value })
                                    }
                                    placeholder="e.g. United States"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Today's Brief */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-accent-ink/60 mb-3">
                            Today&apos;s Brief
                          </h4>
                          {isLoadingBrief ? (
                            <div className="flex flex-col items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-accent-gold mb-2" />
                              <p className="text-sm text-accent-ink/50">
                                Generating today&apos;s brief...
                              </p>
                            </div>
                          ) : connection.fullBrief ? (
                            <div className="space-y-4">
                              <div>
                                <h5 className="text-lg font-medium text-accent-gold mb-2">
                                  {connection.fullBrief.title}
                                </h5>
                                <p className="text-accent-ink/80 leading-relaxed">
                                  {connection.fullBrief.shared_vibe}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-accent-ink/60 mb-2">
                                  Ways to show up
                                </p>
                                <ul className="space-y-2">
                                  {connection.fullBrief.ways_to_show_up.map((way, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-accent-gold">→</span>
                                      <span className="text-accent-ink/80">{way}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {connection.fullBrief.nudge && (
                                <div className="bg-accent-muted/30 rounded-lg p-3">
                                  <p className="text-sm text-accent-ink/70 italic">
                                    {connection.fullBrief.nudge}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : connection.todayBrief ? (
                            <div>
                              <p className="text-accent-ink/80 leading-relaxed">
                                {connection.todayBrief.shared_vibe}
                              </p>
                              <Button
                                variant="link"
                                size="sm"
                                className="mt-2 px-0"
                                onClick={() => generateBriefForConnection(connection.id)}
                              >
                                Load full brief
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-accent-ink/50 mb-3">
                                No brief generated yet for today.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateBriefForConnection(connection.id)}
                              >
                                Generate brief
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        <div>
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-accent-ink/60 mb-3">
                            Notes
                          </h4>
                          <textarea
                            value={notesMap[connection.id] || ""}
                            onChange={(e) =>
                              setNotesMap({ ...notesMap, [connection.id]: e.target.value })
                            }
                            placeholder={`Add notes about ${connection.name}...`}
                            className="w-full h-24 p-3 border border-accent-muted rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-accent-ink text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-accent-ink/40">
                              Notes are private and only visible to you
                            </p>
                            <div className="flex items-center gap-2">
                              {notesSavedId === connection.id && (
                                <span className="text-xs text-green-600">Saved!</span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveNotes(connection.id);
                                }}
                                disabled={savingNotesId === connection.id}
                              >
                                {savingNotesId === connection.id ? "Saving..." : "Save notes"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Add connection form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Add connection</CardTitle>
              <p className="text-sm text-accent-ink/60">
                Share someone&apos;s birth details to explore your compatibility and
                relational dynamics
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddConnection} className="space-y-4">
                {addError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{addError}</p>
                  </div>
                )}

                {savedMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700">Connection added</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Their name"
                    required
                    disabled={isAddingConnection}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationshipType">Relationship type</Label>
                  <select
                    id="relationshipType"
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
                    disabled={isAddingConnection}
                  >
                    {RELATIONSHIP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate">Birth date (optional)</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={isAddingConnection}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthTime">Birth time (optional)</Label>
                  <Input
                    id="birthTime"
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    disabled={unknownBirthTime || isAddingConnection}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="unknownBirthTime"
                      checked={unknownBirthTime}
                      onChange={(e) => setUnknownBirthTime(e.target.checked)}
                      className="rounded"
                      disabled={isAddingConnection}
                    />
                    <label
                      htmlFor="unknownBirthTime"
                      className="text-sm text-accent-ink/70"
                    >
                      I don&apos;t know their birth time
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthCity">Birth city (optional)</Label>
                  <Input
                    id="birthCity"
                    value={birthCity}
                    onChange={(e) => setBirthCity(e.target.value)}
                    placeholder="e.g. Los Angeles"
                    disabled={isAddingConnection}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthRegion">Birth region (optional)</Label>
                  <Input
                    id="birthRegion"
                    value={birthRegion}
                    onChange={(e) => setBirthRegion(e.target.value)}
                    placeholder="e.g. California"
                    disabled={isAddingConnection}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthCountry">Birth country (optional)</Label>
                  <Input
                    id="birthCountry"
                    value={birthCountry}
                    onChange={(e) => setBirthCountry(e.target.value)}
                    placeholder="e.g. United States"
                    disabled={isAddingConnection}
                  />
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  className="w-full"
                  disabled={isAddingConnection}
                >
                  {isAddingConnection ? "Adding..." : "Add connection"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Space Between Sheet */}
      <SpaceBetweenSheet
        open={spaceSheetOpen}
        onOpenChange={setSpaceSheetOpen}
        connectionId={spaceSheetConnectionId}
        connectionName={spaceSheetConnectionName}
      />
    </div>
  );
}
