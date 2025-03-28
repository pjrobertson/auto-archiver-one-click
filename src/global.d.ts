import { ChildProcessWithoutNullStreams } from 'child_process';

declare global {
  var archiverSessions: Map<string, {
    command: ChildProcessWithoutNullStreams;
    events: Array<{
      type: string;
      data: string;
      timestamp: number;
    }>;
    isComplete: boolean;
    exitCode: number | null;
    error: Error | null;
  }>;
}

export {};