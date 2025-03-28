"use client";
import { useCallback, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { startAutoArchiver, getSessionEvents, terminateSession } from "./actions";

import {
  Button,
  Input,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Container,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import EditIcon from '@mui/icons-material/Edit';
import LaunchIcon from '@mui/icons-material/Launch';
import TextField from '@mui/material/TextField';

// Polling interval in milliseconds
const POLLING_INTERVAL = 500;

export default function Home() {
  // State
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Refs for polling
  const sessionIdRef = useRef<string | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logs when they update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      if (sessionIdRef.current) {
        terminateSession(sessionIdRef.current);
      }
    };
  }, []);
  
  // Poll for log updates
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      if (!sessionIdRef.current) return;
      
      try {
        const updates = await getSessionEvents(sessionIdRef.current, lastTimestampRef.current);
        
        if (updates.events.length > 0) {
          setLogs(prevLogs => [
            ...prevLogs,
            ...updates.events.map((event: any) => event.data)
          ]);
          
          // Update the latest timestamp
          const latestEvent = updates.events[updates.events.length - 1];
          lastTimestampRef.current = latestEvent.timestamp;
        }
        
        // Check if the process has completed
        if (updates.isComplete) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          setIsRunning(false);
          
          if (updates.error) {
            setError(updates.error);
          } else if (updates.exitCode === 0) {
            setSuccess("Process completed successfully");
          } else {
            setError(`Process exited with code ${updates.exitCode}`);
          }
        }
      } catch (err: any) {
        console.error("Error polling for updates:", err);
      }
    }, POLLING_INTERVAL);
  }, []);
  
  // Form submission handler
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Reset state
    setIsRunning(true);
    setLogs([]);
    setError(null);
    setSuccess(null);
    lastTimestampRef.current = 0;
    
    // Clean up any existing session
    if (sessionIdRef.current) {
      try {
        await terminateSession(sessionIdRef.current);
      } catch (e) {
        console.error("Error terminating session:", e);
      }
    }
    
    try {
      const formData = new FormData(event.currentTarget);
      const url = formData.get('url') as string;
      
      if (!url) {
        setError("URL is required");
        setIsRunning(false);
        return;
      }
      
      // Start the archiver process and get a session ID
      const sessionId = await startAutoArchiver({ url });
      sessionIdRef.current = sessionId;
      
      // Start polling for updates
      startPolling();
      
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
      setIsRunning(false);
    }
  }, [startPolling]);

  return (
    <Container maxWidth={false} sx={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', py: 4 }}>
      <Box sx={{ width: '800px' }}>
        <Stack
          direction={'column'}
          spacing={3}
        >
          <Box>
            <Image
              src="/bc.png"
              alt="Bellingcat logo"
              width={167}
              height={39}
              priority
            />
            <Typography variant="h4" component="h1" sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
              Auto Archiver One-Click
            </Typography>
            <ul>
              <li>
                Edit your config file (TODO: add config-editor interface)
              </li>
              <li>
                Click the button below to run Auto Archiver
              </li>
            </ul>
          </Box>
          <Box>
            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            {success && (
              <Typography color="success.main" sx={{ mb: 2 }}>
                {success}
              </Typography>
            )}
            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  name="url"
                  label="URL"
                  variant="outlined"
                  fullWidth
                  required
                  disabled={isRunning}
                />
                <Button
                  variant="contained"
                  type="submit"
                  disabled={isRunning}
                >
                  {isRunning ? 'Running...' : 'Run Auto Archiver'}
                </Button>
              </Stack>
            </form>
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                Logs Output 
                {isRunning && (
                  <Typography component="span" sx={{ ml: 1, fontSize: '0.8rem', color: '#888' }}>
                    (streaming...)
                  </Typography>
                )}
              </Typography>
              
              <Box 
                sx={{ 
                  position: 'relative',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  p: 1,
                  backgroundColor: '#f9f9f9',
                  height: '400px',
                  overflow: 'auto'
                }}
              >
                <Box 
                  component="pre"
                  sx={{ 
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '0.85rem',
                    whiteSpace: 'pre',
                    m: 0,
                    overflow: 'visible'
                  }}
                >
                  {logs.join('')}
                  {/* This hidden div is used for auto-scrolling */}
                  <div ref={logEndRef} style={{ height: '1px', width: '1px' }} />
                </Box>
              </Box>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Link
              href="https://auto-archiver.readthedocs.io/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              underline="hover"
            >
              <ArticleIcon fontSize="small" />
              Docs
            </Link>
            <Link
              href="https://github.com/bellingcat/auto-archiver"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              underline="hover"
            >
              <Image
                aria-hidden
                src="/globe.svg"
                alt="Bellingcat Website"
                width={16}
                height={16}
              />
              Bellingcat
            </Link>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
}