/** Frontend contract v001. Types only; Unity bridge is NOT implemented by this file. */
export type Outcome = 'pending' | 'completed' | 'failed' | 'aborted';
export type AssessmentCode = 'TASK_SMOOTH' | 'TASK_SELF_CORRECTED' | 'TASK_GUIDED_COMPLETED' | 'TASK_REPEATED_ERRORS' | 'TASK_INCOMPLETE';
export interface CommandBase {
  schemaVersion: 1;
  protocol: 'career-experience';
  requestId: string;
  sessionId: string;
  experienceId: string;
  roomId: string;
}
export interface StartExperienceCommand extends CommandBase {
  action: 'start_experience';
  scenarioId: string;
  scenarioVersion: string;
}
export interface EndExperienceCommand extends CommandBase {
  action: 'end_experience';
  reason: 'USER_REQUESTED_END';
}
export type ExperienceCommand = StartExperienceCommand | EndExperienceCommand;
export interface ProcessSummary {
  scope: 'interaction' | 'scenario';
  measurementStatus: 'complete' | 'partial' | 'unavailable';
  measurementNote: string | null;
  attemptCount: number | null;
  navigationBackCount: number | null;
  backtrackCount: number | null;
  retryCount: number | null;
  mistakeCount: number | null;
  repeatedMistakeCount: number | null;
  helpRequestCount: number | null;
  guidanceUsed: boolean | null;
  elapsedActiveMs: number | null;
}
export interface TerminationContext {
  terminationId: string;
  code: string;
  initiatedBy: 'user' | 'system' | 'unknown';
  workStarted: boolean | null;
  lastStepId: string | null;
  lastObjectId: string | null;
  lastState: string | null;
  completedStepIds: string[] | null;
  remainingStepIds: string[] | null;
  inFlightActionIds: string[] | null;
  userProvidedReason?: string;
}
export interface InterpretationContext {
  assessmentStatus: 'pending' | 'evaluated' | 'unavailable';
  assessmentCode: AssessmentCode | null;
  ruleVersion: 'v001';
  reasonCodes: string[];
  evidenceEventIds: string[];
  interpretation: string | null;
  limitations: string[];
  termination?: TerminationContext | null;
}
export type WorkResult =
  | { outcome: 'pending'; success: null; completionCode: null; data: Record<string, unknown> }
  | { outcome: 'completed'; success: true; completionCode: string; data: Record<string, unknown> }
  | { outcome: 'failed' | 'aborted'; success: false; completionCode: string; data: Record<string, unknown> };
export interface EventEnvelope {
  schemaVersion: 1;
  protocol: 'career-experience';
  eventId: string;
  sequence: number;
  occurredAt: string;
  requestId: string | null;
  sessionId: string;
  experienceId: string;
  roomId: string;
  scenarioRunId: string;
  buildId: string;
  sceneId: string;
  scenarioId: string;
  scenarioVersion: string;
  objectId: string | null;
  instanceId: string | null;
  assetId: string | null;
  assetVersion: string | null;
  stepId: string | null;
  workItemId: string | null;
  attemptId: string | null;
  requestRevision: number | null;
  documentRevision: number | null;
  type: string;
  action: string;
  process: ProcessSummary;
  result: WorkResult;
  context: InterpretationContext;
  data: Record<string, unknown>;
}
export type StartedResponse = EventEnvelope & {
  type: 'experience.started'; action: 'start_experience'; requestId: string;
  result: Extract<WorkResult, {outcome: 'pending'}>;
};
export type EndedResponse = EventEnvelope & {
  type: 'experience.ended'; action: 'end_experience'; requestId: string;
  result: Exclude<WorkResult, {outcome: 'pending'}>;
};
export interface ControlErrorResponse extends CommandBase {
  type: 'experience.error';
  error: {code: string; message: string};
}
export type FrontendResponse = StartedResponse | EndedResponse | ControlErrorResponse;
/** Implement this adapter using the chosen Unity renderer. No concrete Unity handler name is assumed. */
export interface ExperienceTransport {
  send(command: ExperienceCommand): void;
  subscribe(listener: (response: FrontendResponse) => void): () => void;
}
