"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/Chip";
import { Connection, ConnectionInsight } from "@/types";
import Link from "next/link";

export default function ConnectionsPage() {
  // Connections list state
  const [connections, setConnections] = useState<Connection[]>([]);
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

  // Connection insight state
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectionInsight, setConnectionInsight] = useState<ConnectionInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

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

      // Add new connection to list
      setConnections([...connections, data.connection]);

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

  const handleConnectionClick = async (connectionId: string) => {
    try {
      setSelectedConnectionId(connectionId);
      setInsightLoading(true);
      setInsightError(null);
      setConnectionInsight(null);

      const response = await fetch("/api/connection-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400 && data.error === "Incomplete profile") {
          setInsightError(
            "Please complete your birth signature in Settings to view connection insights."
          );
        } else if (response.status === 404) {
          setInsightError("This connection doesn't exist or you don't have access to it.");
        } else {
          setInsightError(data.message || "Unable to generate insight. Please try again.");
        }
        return;
      }

      setConnectionInsight(data);
    } catch (err: any) {
      console.error("Error loading connection insight:", err);
      setInsightError("Unable to load connection insight. Please try again.");
    } finally {
      setInsightLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
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

      // Clear selected if deleted
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null);
        setConnectionInsight(null);
      }
    } catch (err: any) {
      console.error("Error deleting connection:", err);
      alert(err.message || "Unable to delete connection. Please try again.");
    }
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
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-accent-ink/60">Loading your connections...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="text-center py-12 border-red-200">
              <CardContent>
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={loadConnections}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : connections.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-5xl mb-4">🤝</div>
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
                  className={
                    selectedConnectionId === connection.id
                      ? "border-gold-500 border-2"
                      : ""
                  }
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{connection.name}</h3>
                        <p className="text-sm text-accent-ink/60">
                          {connection.relationship_type}
                        </p>
                        {connection.birth_date && (
                          <p className="text-xs text-accent-ink/50 mt-1">
                            Born {new Date(connection.birth_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectionClick(connection.id)}
                          disabled={insightLoading && selectedConnectionId === connection.id}
                        >
                          {insightLoading && selectedConnectionId === connection.id
                            ? "Loading..."
                            : "View insight"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteConnection(connection.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    {/* Show insight if this connection is selected */}
                    {selectedConnectionId === connection.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {insightLoading ? (
                          <div className="text-center py-8">
                            <div className="text-3xl mb-2">✨</div>
                            <p className="text-sm text-accent-ink/60">
                              Generating relational insight...
                            </p>
                          </div>
                        ) : insightError ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-700">{insightError}</p>
                            {insightError.includes("Settings") && (
                              <Link href="/settings">
                                <Button variant="link" size="sm" className="mt-2 p-0">
                                  Go to Settings →
                                </Button>
                              </Link>
                            )}
                          </div>
                        ) : connectionInsight ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-gold-600 mb-2">Overview</h4>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {connectionInsight.overview}
                              </p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gold-600 mb-2">
                                Emotional Dynamics
                              </h4>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {connectionInsight.emotionalDynamics}
                              </p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gold-600 mb-2">
                                Communication
                              </h4>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {connectionInsight.communication}
                              </p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gold-600 mb-2">
                                Care Suggestions
                              </h4>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {connectionInsight.careSuggestions}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
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
                    <p className="text-sm text-green-700">✓ Connection added</p>
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
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
