"use server";

import { spawn } from 'child_process';

// create the 'config' type
export type Config = {
  url: string;
}

export type ExecuteAAResponse = {
  message: string | null;
  error: string | null;
}

// This function starts the auto-archiver process and returns a session ID
export async function startAutoArchiver(config: Config): Promise<string> {
  // Generate a unique session ID
  const sessionId = `aa-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Store the process and its streams in a global Map
  // Note: In a real app, you'd use Redis or another storage solution for production
  if (typeof global.archiverSessions === 'undefined') {
    global.archiverSessions = new Map();
  }

  // Start the process
  const command = spawn('auto-archiver', [config.url]);
  
  // Store the command and create an event emitter for this session
  global.archiverSessions.set(sessionId, {
    command,
    events: [],
    isComplete: false,
    exitCode: null,
    error: null
  });
  
  // Handle output
  command.stdout.on('data', (data) => {
    const logData = data.toString();
    const session = global.archiverSessions.get(sessionId);
    if (session) {
      session.events.push({
        type: 'log',
        data: logData,
        timestamp: Date.now()
      });
    }
  });
  
  command.stderr.on('data', (data) => {
    const logData = data.toString();
    const session = global.archiverSessions.get(sessionId);
    if (session) {
      session.events.push({
        type: 'log',
        data: logData,
        timestamp: Date.now()
      });
    }
  });
  
  command.on('close', (code) => {
    const session = global.archiverSessions.get(sessionId);
    if (session) {
      session.isComplete = true;
      session.exitCode = code;
      session.events.push({
        type: 'close',
        data: code === 0 ? 'Process completed successfully' : `Process exited with code ${code}`,
        timestamp: Date.now()
      });
    }
  });
  
  command.on('error', (error) => {
    const session = global.archiverSessions.get(sessionId);
    if (session) {
      session.isComplete = true;
      session.error = error;
      session.events.push({
        type: 'error',
        data: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  return sessionId;
}

// This function will be called by the frontend to get new logs since a specific timestamp
export async function getSessionEvents(sessionId: string, since: number = 0): Promise<any> {
  const session = global.archiverSessions?.get(sessionId);
  
  if (!session) {
    return {
      error: 'Session not found',
      events: [],
      isComplete: true
    };
  }
  
  // Get all events since the given timestamp
  const newEvents = session.events.filter(event => event.timestamp > since);
  
  return {
    events: newEvents,
    isComplete: session.isComplete,
    exitCode: session.exitCode,
    error: session.error ? session.error.message : null
  };
}

// A helper function to terminate a session (cleanup)
export async function terminateSession(sessionId: string): Promise<void> {
  const session = global.archiverSessions?.get(sessionId);
  
  if (session && !session.isComplete) {
    try {
      session.command.kill();
    } catch (e) {
      console.error('Error terminating process:', e);
    }
  }
  
  if (global.archiverSessions?.has(sessionId)) {
    global.archiverSessions.delete(sessionId);
  }
}

