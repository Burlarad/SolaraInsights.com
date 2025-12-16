"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/Chip";
import { Connection } from "@/types";
import { formatDateForDisplay } from "@/lib/datetime";
import { Link2, Unlink, ArrowRight } from "lucide-react";

// Extended type with brief preview
interface ConnectionWithPreview extends Connection {
  todayBrief?: {
    title: string;
    shared_vibe: string;
  } | null;
}

// Truncate text to specified length
function truncateText(text: string, maxLength: number = 140): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export default function ConnectionsPage() {
  const router = useRouter();

  // Connections list state
  const [connections, setConnections] = useState<ConnectionWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/connections");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load connections");
      }

      setConnections(data.connections || []);
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

      // Add new connection to list (without brief preview)
      setConnections([...connections, { ...data.connection, todayBrief: null }]);

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
    e.stopPropagation(); // Prevent card click

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

      // Remove from list
      setConnections(connections.filter((c) => c.id !== connectionId));
    } catch (err: any) {
      console.error("Error deleting connection:", err);
      alert(err.message || "Unable to delete connection. Please try again.");
    }
  };

  const openConnection = (connectionId: string) => {
    router.push(`/sanctuary/connections/${connectionId}`);
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
                <div className="text-5xl mb-4">...</div>
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
              {connections.map((connection) => (
                <Card
                  key={connection.id}
                  className="cursor-pointer hover:border-accent-gold/50 hover:shadow-md transition-all"
                  onClick={() => openConnection(connection.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold">{connection.name}</h3>
                          {connection.linked_profile_id ? (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteConnection(connection.id, e)}
                          className="text-accent-ink/40 hover:text-red-500"
                        >
                          Delete
                        </Button>
                        <ArrowRight className="h-4 w-4 text-accent-ink/30" />
                      </div>
                    </div>

                    {/* Mini preview */}
                    <div className="mt-3 pt-3 border-t border-accent-muted/50">
                      {connection.todayBrief ? (
                        <p className="text-sm text-accent-ink/70 leading-relaxed">
                          {truncateText(connection.todayBrief.shared_vibe, 150)}
                        </p>
                      ) : (
                        <p className="text-sm text-accent-ink/50 italic">
                          Open to generate today&apos;s brief
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                    <option value="Partner">Partner</option>
                    <option value="Child">Child</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Other">Other</option>
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
    </div>
  );
}
