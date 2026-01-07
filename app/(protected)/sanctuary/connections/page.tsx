"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { SpaceBetweenSheet } from "@/components/sanctuary/SpaceBetweenSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/Chip";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";
import { Connection, DailyBrief } from "@/types";
import { formatDateForDisplay } from "@/lib/datetime";
import { pickRotatingMessage, getErrorCategory, type ApiErrorResponse } from "@/lib/ui/pickRotatingMessage";
import { useTranslations } from "next-intl";

interface BriefErrorInfo {
  message: string;
  errorCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  status: number;
  attempt: number;
}
import {
  ChevronDown,
  Loader2,
  Pencil,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
  const t = useTranslations("connections");
  const tCommon = useTranslations("common");

  // Connections list state
  const [connections, setConnections] = useState<ConnectionWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card state
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Edit mode state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    relationship_type: "",
    birth_date: "",
    birth_time: "",
  });
  const [editBirthPlace, setEditBirthPlace] = useState<PlaceSelection | null>(null);
  const [editBirthPlaceDisplay, setEditBirthPlaceDisplay] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Notes state
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [notesSavedId, setNotesSavedId] = useState<string | null>(null);

  // Brief loading state (per connection)
  const [loadingBriefIds, setLoadingBriefIds] = useState<Set<string>>(new Set());
  // Brief errors state (per connection)
  const [briefErrors, setBriefErrors] = useState<Record<string, BriefErrorInfo>>({});
  // Brief attempt counters (per connection)
  const [briefAttempts, setBriefAttempts] = useState<Record<string, number>>({});

  // Space Between sheet state
  const [spaceSheetOpen, setSpaceSheetOpen] = useState(false);
  const [spaceSheetConnectionId, setSpaceSheetConnectionId] = useState("");
  const [spaceSheetConnectionName, setSpaceSheetConnectionName] = useState("");

  // Add connection form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationshipType, setRelationshipType] = useState("Partner");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState<PlaceSelection | null>(null);
  const [birthPlaceDisplay, setBirthPlaceDisplay] = useState("");
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  // Refs for IntersectionObserver
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate brief for a connection (lazy loaded on intersection)
  const generateBriefForConnection = useCallback(
    async (connectionId: string) => {
      if (loadingBriefIds.has(connectionId)) return;

      // Increment attempt counter
      const currentAttempt = (briefAttempts[connectionId] || 0) + 1;
      setBriefAttempts((prev) => ({ ...prev, [connectionId]: currentAttempt }));

      // Clear previous error
      setBriefErrors((prev) => {
        const next = { ...prev };
        delete next[connectionId];
        return next;
      });

      setLoadingBriefIds((prev) => new Set(prev).add(connectionId));

      try {
        const response = await fetch("/api/connection-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        });

        // Check content-type to avoid parsing non-JSON
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const rotatingMessage = pickRotatingMessage({
            category: "non_json_response",
            attempt: currentAttempt,
          });
          setBriefErrors((prev) => ({
            ...prev,
            [connectionId]: {
              message: rotatingMessage,
              status: response.status,
              attempt: currentAttempt,
            },
          }));
          return;
        }

        const data = await response.json();

        if (response.ok) {
          // Success - clear attempts counter
          setBriefAttempts((prev) => ({ ...prev, [connectionId]: 0 }));
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
        } else {
          // Error response
          const apiError = data as ApiErrorResponse;
          const category = getErrorCategory(response.status, apiError.errorCode);
          const rotatingMessage = pickRotatingMessage({
            category,
            attempt: currentAttempt,
            retryAfterSeconds: apiError.retryAfterSeconds,
          });
          setBriefErrors((prev) => ({
            ...prev,
            [connectionId]: {
              message: rotatingMessage,
              errorCode: apiError.errorCode,
              requestId: apiError.requestId,
              retryAfterSeconds: apiError.retryAfterSeconds,
              status: response.status,
              attempt: currentAttempt,
            },
          }));
        }
      } catch (err) {
        console.error("Error generating brief:", err);
        const rotatingMessage = pickRotatingMessage({
          category: "provider_500",
          attempt: currentAttempt,
        });
        setBriefErrors((prev) => ({
          ...prev,
          [connectionId]: {
            message: rotatingMessage,
            status: 500,
            attempt: currentAttempt,
          },
        }));
      } finally {
        setLoadingBriefIds((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      }
    },
    [loadingBriefIds, briefAttempts]
  );

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
  }, [connections, loadingBriefIds, generateBriefForConnection]);

  // Supabase Realtime subscription for unlock status changes
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel("connections-unlock-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "connections",
        },
        (payload) => {
          const updated = payload.new as Connection;
          // Update the connection in local state if it's one of ours
          setConnections((prev) =>
            prev.map((c) =>
              c.id === updated.id
                ? {
                    ...c,
                    is_mutual: updated.is_mutual,
                    space_between_enabled: updated.space_between_enabled,
                    is_space_between_unlocked: updated.is_space_between_unlocked,
                    linked_profile_id: updated.linked_profile_id,
                  }
                : c
            )
          );

          // Auto-close sheet if Space Between becomes locked
          if (
            spaceSheetConnectionId === updated.id &&
            spaceSheetOpen &&
            !updated.is_space_between_unlocked
          ) {
            setSpaceSheetOpen(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceSheetConnectionId, spaceSheetOpen]);

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

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsAddingConnection(true);
      setAddError(null);

      // Build request body with optional birth location
      const requestBody: Record<string, unknown> = {
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        relationship_type: relationshipType,
        birth_date: birthDate || null,
        birth_time: unknownBirthTime ? null : birthTime || null,
      };

      // Include birth location if selected from PlacePicker
      if (birthPlace) {
        requestBody.birth_city = birthPlace.birth_city;
        requestBody.birth_region = birthPlace.birth_region;
        requestBody.birth_country = birthPlace.birth_country;
        requestBody.birth_lat = birthPlace.birth_lat;
        requestBody.birth_lon = birthPlace.birth_lon;
        // Server will compute timezone from coordinates
      }

      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setRelationshipType("Partner");
      setBirthDate("");
      setBirthTime("");
      setBirthPlace(null);
      setBirthPlaceDisplay("");
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

  const toggleSpaceBetweenEnabled = async (connection: ConnectionWithPreview, e: React.MouseEvent) => {
    e.stopPropagation();

    const newValue = !connection.space_between_enabled;

    // Optimistically update UI
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connection.id
          ? { ...c, space_between_enabled: newValue }
          : c
      )
    );

    // If turning OFF and sheet is open for this connection, close it
    if (!newValue && spaceSheetConnectionId === connection.id && spaceSheetOpen) {
      setSpaceSheetOpen(false);
    }

    try {
      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: connection.id,
          space_between_enabled: newValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update toggle");
      }

      // The realtime subscription will update the is_space_between_unlocked flag
    } catch (err: any) {
      console.error("Error toggling space_between_enabled:", err);
      // Revert on error
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connection.id
            ? { ...c, space_between_enabled: !newValue }
            : c
        )
      );
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
      first_name: connection.first_name || "",
      middle_name: connection.middle_name || "",
      last_name: connection.last_name || "",
      relationship_type: connection.relationship_type,
      birth_date: connection.birth_date || "",
      birth_time: connection.birth_time || "",
    });

    // Initialize birth place from connection if coordinates exist
    if (connection.birth_city && connection.birth_lat && connection.birth_lon && connection.timezone) {
      const displayParts = [
        connection.birth_city,
        connection.birth_region,
        connection.birth_country,
      ].filter(Boolean);
      setEditBirthPlaceDisplay(displayParts.join(", "));
      setEditBirthPlace({
        birth_city: connection.birth_city,
        birth_region: connection.birth_region || "",
        birth_country: connection.birth_country || "",
        birth_lat: connection.birth_lat,
        birth_lon: connection.birth_lon,
        timezone: connection.timezone,
      });
    } else if (connection.birth_city) {
      // Have city but no coordinates - show label but require re-select
      const displayParts = [
        connection.birth_city,
        connection.birth_region,
        connection.birth_country,
      ].filter(Boolean);
      setEditBirthPlaceDisplay(displayParts.join(", "));
      setEditBirthPlace(null); // Needs re-selection
    } else {
      setEditBirthPlaceDisplay("");
      setEditBirthPlace(null);
    }
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
        first_name: editForm.first_name,
        middle_name: editForm.middle_name || null,
        last_name: editForm.last_name,
        relationship_type: editForm.relationship_type,
      };

      // Only include birth fields if not linked
      if (!isLinked) {
        updatePayload.birth_date = editForm.birth_date || null;
        updatePayload.birth_time = editForm.birth_time || null;

        // Include birth location from PlacePicker if selected
        if (editBirthPlace) {
          updatePayload.birth_city = editBirthPlace.birth_city;
          updatePayload.birth_region = editBirthPlace.birth_region;
          updatePayload.birth_country = editBirthPlace.birth_country;
          updatePayload.birth_lat = editBirthPlace.birth_lat;
          updatePayload.birth_lon = editBirthPlace.birth_lon;
          // Server will compute timezone from coordinates
        } else {
          // Clear birth location if PlacePicker is empty
          updatePayload.birth_city = null;
          updatePayload.birth_region = null;
          updatePayload.birth_country = null;
          updatePayload.birth_lat = null;
          updatePayload.birth_lon = null;
        }
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
      {/* Solara Logo */}
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      <div className="flex items-center justify-between">
        <SanctuaryTabs />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">{t("title")}</h1>
        <p className="text-accent-ink/60">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Connection list */}
        <div className="lg:col-span-2 space-y-4">
          <p className="micro-label">{t("yourConnections")}</p>

          {loading ? (
            <Card className="text-center py-12">
              <CardContent>
                <Loader2 className="h-8 w-8 animate-spin text-accent-gold mx-auto mb-4" />
                <p className="text-accent-ink/60">{t("loading")}</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="text-center py-12 border-red-200">
              <CardContent>
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={loadConnections}>
                  {tCommon("tryAgain")}
                </Button>
              </CardContent>
            </Card>
          ) : connections.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-accent-ink/60">
                  {t("noConnections")}
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
                          </div>
                          <div className="flex items-center gap-3">
                            <Chip className="text-xs">{connection.relationship_type}</Chip>
                            {connection.birth_date && (
                              <span className="text-xs text-accent-ink/50">
                                {t("born")} {formatDateForDisplay(connection.birth_date)}
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
                          ) : briefErrors[connection.id] ? (
                            <div className="space-y-2">
                              <p className="text-sm text-accent-ink/70">
                                {briefErrors[connection.id].message}
                              </p>
                              <p className="text-xs text-accent-ink/40 font-mono">
                                {briefErrors[connection.id].errorCode && `Code: ${briefErrors[connection.id].errorCode}`}
                                {briefErrors[connection.id].requestId && ` • Req: ${briefErrors[connection.id].requestId}`}
                                {briefErrors[connection.id].retryAfterSeconds && ` • Retry: ${briefErrors[connection.id].retryAfterSeconds}s`}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateBriefForConnection(connection.id);
                                }}
                              >
                                Try again
                              </Button>
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
                          {connection.is_space_between_unlocked && (
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={(e) => openSpaceBetween(connection, e)}
                            >
                              Open Space Between
                            </Button>
                          )}
                          <div className="flex-1" />
                          {/* Space Between Toggle - only show when mutual (both users added each other) */}
                          {connection.is_mutual && (
                            <button
                              onClick={(e) => toggleSpaceBetweenEnabled(connection, e)}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                                connection.space_between_enabled
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-accent-ink/40 hover:text-accent-ink/60"
                              )}
                              title={connection.space_between_enabled
                                ? "Space Between is enabled for this connection"
                                : "Space Between is disabled for this connection"
                              }
                            >
                              {connection.space_between_enabled ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                              <span>Space Between</span>
                            </button>
                          )}
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
                                <Label>First name</Label>
                                <Input
                                  value={editForm.first_name}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, first_name: e.target.value })
                                  }
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Last name</Label>
                                <Input
                                  value={editForm.last_name}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, last_name: e.target.value })
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Middle name (optional)</Label>
                                <Input
                                  value={editForm.middle_name}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, middle_name: e.target.value })
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
                                <div className="space-y-2 sm:col-span-2">
                                  <Label>Birth Location</Label>
                                  <PlacePicker
                                    initialValue={editBirthPlaceDisplay}
                                    placeholder="Search for their birth city..."
                                    onSelect={(place) => {
                                      setEditBirthPlace(place);
                                      const displayParts = [
                                        place.birth_city,
                                        place.birth_region,
                                        place.birth_country,
                                      ].filter(Boolean);
                                      setEditBirthPlaceDisplay(displayParts.join(", "));
                                    }}
                                    onClear={() => {
                                      setEditBirthPlace(null);
                                      setEditBirthPlaceDisplay("");
                                    }}
                                  />
                                  <p className="text-xs text-accent-ink/60">
                                    Start typing to search, then select from the results
                                  </p>
                                  {editBirthPlace && (
                                    <p className="text-xs text-accent-ink/60">
                                      Timezone: {editBirthPlace.timezone}
                                    </p>
                                  )}
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
                          ) : briefErrors[connection.id] ? (
                            <div className="text-center py-6 space-y-3">
                              <p className="text-accent-ink/70">
                                {briefErrors[connection.id].message}
                              </p>
                              <p className="text-xs text-accent-ink/40 font-mono">
                                {briefErrors[connection.id].errorCode && `Code: ${briefErrors[connection.id].errorCode}`}
                                {briefErrors[connection.id].requestId && ` • Req: ${briefErrors[connection.id].requestId}`}
                                {briefErrors[connection.id].retryAfterSeconds && ` • Retry: ${briefErrors[connection.id].retryAfterSeconds}s`}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateBriefForConnection(connection.id)}
                              >
                                Try again
                              </Button>
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
                                {savingNotesId === connection.id ? t("saving") : t("saveNotes")}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First"
                      required
                      disabled={isAddingConnection}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      required
                      disabled={isAddingConnection}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle name (optional)</Label>
                  <Input
                    id="middleName"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Middle"
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
                  <Label>Birth location (optional)</Label>
                  <PlacePicker
                    initialValue={birthPlaceDisplay}
                    placeholder="Search for their birth city..."
                    disabled={isAddingConnection}
                    onSelect={(place) => {
                      setBirthPlace(place);
                      const displayParts = [
                        place.birth_city,
                        place.birth_region,
                        place.birth_country,
                      ].filter(Boolean);
                      setBirthPlaceDisplay(displayParts.join(", "));
                    }}
                    onClear={() => {
                      setBirthPlace(null);
                      setBirthPlaceDisplay("");
                    }}
                  />
                  <p className="text-xs text-accent-ink/60">
                    Start typing to search, then select from the results
                  </p>
                  {birthPlace && (
                    <p className="text-xs text-accent-ink/60">
                      Timezone: {birthPlace.timezone}
                    </p>
                  )}
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
