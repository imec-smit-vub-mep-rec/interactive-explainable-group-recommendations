"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ChatTranscript, { type ChatLogRecord } from "@/components/admin/ChatTranscript";
import InteractionTimeline, {
  type InteractionEvent,
} from "@/components/admin/InteractionTimeline";

type SessionSummary = {
  id: string;
  prolific_pid: string | null;
  start_time: string;
  end_time: string | null;
  is_completed: boolean;
  current_screen: number;
  explanation_modality: string;
  aggregation_strategy: string;
  is_attention_fail: boolean | null;
  is_bot: boolean | null;
};

type SessionDetail = Record<string, unknown> & {
  id: string;
  start_time?: string;
  end_time?: string | null;
  prolific_pid?: string | null;
  prolific_study_id?: string | null;
  prolific_session_id?: string | null;
  reference?: string | null;
  explanation_modality?: string;
  aggregation_strategy?: string;
  is_completed?: boolean;
  current_screen?: number;
  onboarding_demographics_1_age_range?: string | null;
  onboarding_demographics_2_gender?: string | null;
  training_tasks_data?: unknown;
  objective_understanding_tasks_data?: unknown;
  screen_timings?: unknown;
  chat_logs?: unknown;
  nasa_tlx_data?: unknown;
  raw_session_data?: unknown;
  is_attention_fail?: boolean | null;
  is_bot?: boolean | null;
  preliminary_subjective_understanding_1_understand?: number | null;
  preliminary_subjective_understanding_2_predict?: number | null;
  repeat_subjective_understanding_1_understand?: number | null;
  repeat_subjective_understanding_2_predict?: number | null;
  attn_check_1?: unknown;
  attn_check_2?: unknown;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return "—";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "—";
  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs < 0) return "—";
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const ensureArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export default function SessionsDashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [completedFilter, setCompletedFilter] = useState("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [prolificPidFilter, setProlificPidFilter] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (completedFilter !== "all") params.set("completed", completedFilter);
      if (modalityFilter !== "all") params.set("modality", modalityFilter);
      if (strategyFilter !== "all") params.set("strategy", strategyFilter);
      if (prolificPidFilter.trim()) params.set("prolificPid", prolificPidFilter.trim());

      const response = await fetch(`/api/admin/sessions?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions (${response.status})`);
      }
      const data = (await response.json()) as { sessions?: SessionSummary[] };
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, completedFilter, modalityFilter, strategyFilter, prolificPidFilter]);

  const fetchSessionDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedSession(null);
    try {
      const response = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session (${response.status})`);
      }
      const data = (await response.json()) as { session?: SessionDetail };
      setSelectedSession(data.session ?? null);
    } catch (err) {
      setSelectedSession(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (selectedSessionId) {
      void fetchSessionDetail(selectedSessionId);
    }
  }, [selectedSessionId, fetchSessionDetail]);

  const trainingTasks = ensureArray<Record<string, unknown>>(
    selectedSession?.training_tasks_data
  );
  const objectiveTasks = ensureArray<Record<string, unknown>>(
    selectedSession?.objective_understanding_tasks_data
  );
  const screenTimings = ensureArray<Record<string, unknown>>(
    selectedSession?.screen_timings
  );
  const chatLogs = ensureArray<ChatLogRecord>(selectedSession?.chat_logs);
  const nasaTlx = (selectedSession?.nasa_tlx_data ?? {}) as Record<string, number>;

  const sessionSummary = useMemo(() => {
    if (!selectedSession) return null;
    return {
      id: selectedSession.id,
      start: formatDateTime(selectedSession.start_time),
      end: formatDateTime(selectedSession.end_time ?? null),
      duration: formatDuration(selectedSession.start_time, selectedSession.end_time ?? null),
      modality: selectedSession.explanation_modality ?? "—",
      strategy: selectedSession.aggregation_strategy ?? "—",
      completed: selectedSession.is_completed ? "Yes" : "No",
      attentionFail: selectedSession.is_attention_fail ? "Yes" : "No",
    };
  }, [selectedSession]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="from-date">
                From date
              </label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="to-date">
                To date
              </label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Completion</label>
              <Select value={completedFilter} onValueChange={setCompletedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Completed</SelectItem>
                  <SelectItem value="false">In progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modality</label>
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="no_expl">no_expl</SelectItem>
                  <SelectItem value="static_list">static_list</SelectItem>
                  <SelectItem value="interactive_list">interactive_list</SelectItem>
                  <SelectItem value="conversational">conversational</SelectItem>
                  <SelectItem value="interactive_graph">interactive_graph</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Strategy</label>
              <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="lms">lms</SelectItem>
                  <SelectItem value="add">add</SelectItem>
                  <SelectItem value="app">app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="pid-filter">
                Prolific PID
              </label>
              <Input
                id="pid-filter"
                placeholder="Search PID"
                value={prolificPidFilter}
                onChange={(event) => setProlificPidFilter(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={fetchSessions} disabled={loading}>
              {loading ? "Loading..." : "Apply filters"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setCompletedFilter("all");
                setModalityFilter("all");
                setStrategyFilter("all");
                setProlificPidFilter("");
                void fetchSessions();
              }}
            >
              Reset
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Prolific PID</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Screen</TableHead>
                <TableHead>Attn Fail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  data-state={session.id === selectedSessionId ? "selected" : "default"}
                  className="cursor-pointer"
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <TableCell className="max-w-[140px] truncate">{session.id}</TableCell>
                  <TableCell>{session.prolific_pid ?? "—"}</TableCell>
                  <TableCell>{formatDateTime(session.start_time)}</TableCell>
                  <TableCell>
                    {formatDuration(session.start_time, session.end_time)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.is_completed ? "default" : "secondary"}>
                      {session.is_completed ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.explanation_modality}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.aggregation_strategy}</Badge>
                  </TableCell>
                  <TableCell>{session.current_screen}</TableCell>
                  <TableCell>
                    {session.is_attention_fail ? (
                      <Badge variant="destructive">Fail</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {loading ? "Loading sessions..." : "No sessions found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedSessionId && (
            <p className="text-sm text-muted-foreground">Select a session to inspect.</p>
          )}
          {detailLoading && (
            <p className="text-sm text-muted-foreground">Loading session detail...</p>
          )}

          {selectedSession && sessionSummary && (
            <div className="space-y-4">
              <Collapsible defaultOpen>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Overview</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2 space-y-2 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Session ID</div>
                      <div className="break-all">{sessionSummary.id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Prolific PID</div>
                      <div>{selectedSession.prolific_pid ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Start</div>
                      <div>{sessionSummary.start}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">End</div>
                      <div>{sessionSummary.end}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Duration</div>
                      <div>{sessionSummary.duration}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Completion</div>
                      <div>{sessionSummary.completed}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Modality</div>
                      <div>{sessionSummary.modality}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Strategy</div>
                      <div>{sessionSummary.strategy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Attention Fail</div>
                      <div>{sessionSummary.attentionFail}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Current Screen</div>
                      <div>{selectedSession.current_screen ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Age Range</div>
                      <div>{selectedSession.onboarding_demographics_1_age_range ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Gender</div>
                      <div>{selectedSession.onboarding_demographics_2_gender ?? "—"}</div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible defaultOpen>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Chat Logs</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2">
                  <ChatTranscript logs={chatLogs} />
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Training Tasks</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2 space-y-4">
                  {trainingTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No training tasks recorded.
                    </p>
                  )}
                  {trainingTasks.map((task, index) => {
                    const interactions = ensureArray<InteractionEvent>(
                      task.interactions
                    );
                    return (
                      <Card key={`training-${index}`}>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            Training Task {index + 1}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>Scenario: {String(task.scenarioId ?? "—")}</div>
                          <div>Initial Guess: {String(task.step1Answer ?? "—")}</div>
                          <div>Final Decision: {String(task.step3Answer ?? "—")}</div>
                          <div>
                            Duration:{" "}
                            {formatDuration(
                              typeof task.startTime === "string" ? task.startTime : null,
                              typeof task.endTime === "string" ? task.endTime : null
                            )}
                          </div>
                          <InteractionTimeline events={interactions} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Objective Test Tasks</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2 space-y-4">
                  {objectiveTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No objective tasks recorded.
                    </p>
                  )}
                  {objectiveTasks.map((task, index) => {
                    const interactions = ensureArray<InteractionEvent>(
                      task.interactions
                    );
                    return (
                      <Card key={`objective-${index}`}>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            Objective Task {index + 1}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>Scenario: {String(task.scenarioId ?? "—")}</div>
                          <div>Question: {String(task.questionId ?? "—")}</div>
                          <div>Answer: {String(task.userAnswer ?? "—")}</div>
                          <div>
                            Correct:{" "}
                            {task.isCorrect === true
                              ? "Yes"
                              : task.isCorrect === false
                              ? "No"
                              : "—"}
                          </div>
                          <InteractionTimeline events={interactions} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Screen Timings</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2">
                  {screenTimings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No screen timing data recorded.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Screen</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Interactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {screenTimings.map((screen, index) => {
                          const interactions = ensureArray<InteractionEvent>(
                            screen.interactions
                          );
                          return (
                            <TableRow key={`screen-${index}`}>
                              <TableCell>{String(screen.screenName ?? "—")}</TableCell>
                              <TableCell>
                                {formatDateTime(
                                  typeof screen.startTime === "string"
                                    ? screen.startTime
                                    : null
                                )}
                              </TableCell>
                              <TableCell>
                                {formatDateTime(
                                  typeof screen.endTime === "string"
                                    ? screen.endTime
                                    : null
                                )}
                              </TableCell>
                              <TableCell>
                                {formatDuration(
                                  typeof screen.startTime === "string"
                                    ? screen.startTime
                                    : null,
                                  typeof screen.endTime === "string"
                                    ? screen.endTime
                                    : null
                                )}
                              </TableCell>
                              <TableCell>{interactions.length}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Subjective Understanding</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Preliminary Understand</div>
                      <div>{selectedSession.preliminary_subjective_understanding_1_understand ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Preliminary Predict</div>
                      <div>{selectedSession.preliminary_subjective_understanding_2_predict ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Repeat Understand</div>
                      <div>{selectedSession.repeat_subjective_understanding_1_understand ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Repeat Predict</div>
                      <div>{selectedSession.repeat_subjective_understanding_2_predict ?? "—"}</div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">NASA-TLX</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2 text-sm">
                  <div className="grid gap-2 md:grid-cols-3">
                    {[
                      "mental_demand",
                      "physical_demand",
                      "temporal_demand",
                      "performance",
                      "effort",
                      "frustration",
                    ].map((key) => (
                      <div key={key}>
                        <div className="text-xs text-muted-foreground">{key}</div>
                        <div>{nasaTlx[key] ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Raw Session Data</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Toggle
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2">
                  <pre className="max-h-96 overflow-auto rounded-md bg-muted/30 p-3 text-xs">
                    {JSON.stringify(selectedSession.raw_session_data ?? {}, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
