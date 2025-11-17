// frontend/src/pages/Dashboard.js

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [todayJournal, setTodayJournal] = useState(null);
  const [journalContent, setJournalContent] = useState(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualEntry, setManualEntry] = useState(false);
  const [entryText, setEntryText] = useState('');
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    loadUserData();
    loadTodayJournal();
    startWakeWordDetection();
    
    return () => {
      // Cleanup wake word detection
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (todayJournal) {
      loadJournalContent();
      // Restart wake word detection when journal is available
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      startWakeWordDetection();
    }
  }, [todayJournal]);

  const loadUserData = async () => {
    try {
      const response = await api.getMe();
      setUser(response);
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const loadTodayJournal = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const today = new Date().toISOString().split('T')[0];
      const response = await api.getJournal(today);
      setTodayJournal(response);
    } catch (err) {
      // Journal doesn't exist yet, that's okay - not an error
      if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('Journal not found')) {
        setTodayJournal(null);
        setError(null); // Clear error for 404
      } else {
        setError('Failed to load journal: ' + (err.message || 'Unknown error'));
        console.error('Journal load error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadJournalContent = async () => {
    if (!todayJournal) return;
    
    try {
      const content = await api.getJournalContent(todayJournal.id);
      setJournalContent(content);
    } catch (err) {
      console.error('Failed to load journal content:', err);
      setJournalContent(null);
    }
  };

  const startWakeWordDetection = () => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported for wake word detection');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'en-US';
      recognition.continuous = true; // Keep listening
      recognition.interimResults = true; // Get interim results for faster detection
      recognition.maxAlternatives = 1;

      recognition.onresult = (e) => {
        // Check for "Hey Goorderly" in the results
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript.toLowerCase().trim();
          
          // Check if wake word is detected
          if (transcript.includes('hey goorderly') || transcript.includes('hey go orderly')) {
            console.log('Wake word detected!');
            recognition.stop();
            setIsListeningForWakeWord(false);
            
            // Start actual recording
            if (todayJournal) {
              handleStartRecording();
            }
            return;
          }
        }
      };

      recognition.onerror = (e) => {
        // Silently handle errors for wake word detection
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Wake word detection error:', e.error);
        }
      };

      recognition.onend = () => {
        // Restart wake word detection if it wasn't intentionally stopped
        if (!recording && todayJournal) {
          setTimeout(() => {
            try {
              recognition.start();
              setIsListeningForWakeWord(true);
            } catch (err) {
              console.warn('Failed to restart wake word detection:', err);
            }
          }, 100);
        }
      };

      recognitionRef.current = recognition;
      
      // Request microphone permission and start
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach(track => track.stop());
          recognition.start();
          setIsListeningForWakeWord(true);
        })
        .catch((err) => {
          console.warn('Microphone permission not granted for wake word:', err);
        });
    } catch (err) {
      console.warn('Failed to initialize wake word detection:', err);
    }
  };

  const handleStartRecording = async () => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Check if journal exists first
    if (!todayJournal) {
      setError('Please create today\'s journal first before recording voice entries.');
      return;
    }

    // Clear previous errors
    setError(null);
    setSuccess(null);
    
    // Reset retry flag for new attempt
    window._speechRetryAttempted = false;

    // Check microphone permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted, stop the stream
      stream.getTracks().forEach(track => track.stop());
      console.log('✓ Microphone permission granted');
    } catch (permError) {
      console.error('Microphone permission error:', permError);
      if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
        return;
      } else if (permError.name === 'NotFoundError' || permError.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
        return;
      } else {
        setError(`Microphone access error: ${permError.message}. Please check your browser settings.`);
        return;
      }
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    
    try {
      recognition = new SpeechRecognition();
      console.log('✓ Speech recognition initialized');
    } catch (initError) {
      console.error('Failed to initialize speech recognition:', initError);
      setError(`Failed to initialize speech recognition: ${initError.message}`);
      return;
    }

    // Configure recognition
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    // Add debug logging
    console.log('Starting speech recognition with config:', {
      lang: recognition.lang,
      continuous: recognition.continuous,
      interimResults: recognition.interimResults
    });

    recognition.onstart = () => {
      console.log('✓ Speech recognition started');
      setRecording(true);
      setError(null);
    };

    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      // Remove wake word if present
      const cleanedText = text.replace(/hey\s+goorderly\s*/i, '').trim();
      
      if (!cleanedText) {
        setError('No speech detected after wake word. Please try again.');
        setRecording(false);
        // Restart wake word detection
        if (recognitionRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsListeningForWakeWord(true);
            } catch (err) {
              console.warn('Failed to restart wake word detection:', err);
            }
          }, 500);
        }
        return;
      }

      try {
        setError(null);
        await api.logVoiceEntry({
          text: cleanedText,
          timestamp: new Date().toISOString()
        });
        setSuccess(`Entry logged: "${cleanedText}"`);
        setTimeout(() => setSuccess(null), 3000);
        await loadTodayJournal();
        await loadJournalContent();
        
        // Restart wake word detection after successful entry
        if (recognitionRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsListeningForWakeWord(true);
            } catch (err) {
              console.warn('Failed to restart wake word detection:', err);
            }
          }, 1000);
        }
      } catch (err) {
        setError('Failed to log entry: ' + err.message);
        setSuccess(null);
      } finally {
        setRecording(false);
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error, e);
      let errorMessage = '';
      let shouldRetry = false;
      
      switch (e.error) {
        case 'network':
          errorMessage = 'Network error connecting to speech recognition service. This may be temporary.';
          console.error('Network error details:', {
            error: e.error,
            message: e.message,
            timeStamp: e.timeStamp,
            userAgent: navigator.userAgent,
            isSecureContext: window.isSecureContext,
            protocol: window.location.protocol,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled
          });
          
          // Test if we can reach Google's services
          fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' })
            .then(() => console.log('✓ Can reach Google services'))
            .catch(() => console.error('✗ Cannot reach Google services'));
          
          // Network errors are often temporary - suggest retry
          shouldRetry = true;
          
          // Try to restart after a short delay (sometimes helps)
          // But only retry once to avoid infinite loops
          if (!recording && !window._speechRetryAttempted) {
            window._speechRetryAttempted = true;
            console.log('Will attempt automatic retry in 2 seconds...');
            setTimeout(() => {
              window._speechRetryAttempted = false; // Reset for next manual attempt
              if (!recording && todayJournal) {
                console.log('Retrying speech recognition...');
                handleStartRecording();
              }
            }, 2000);
          } else {
            console.warn('⚠️ Chrome Web Speech API network error - this is a known Chrome issue.');
            console.warn('Possible solutions:');
            console.warn('1. Try in incognito mode (Cmd+Shift+N)');
            console.warn('2. Disable Chrome extensions (especially privacy/security ones)');
            console.warn('3. Check Chrome Settings → Privacy → Site Settings → Microphone');
            console.warn('4. Try a different browser (Safari or Firefox)');
            console.warn('5. Check if VPN/proxy is blocking Google services');
          }
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please try speaking again.';
          shouldRetry = true;
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not accessible. Please check your microphone permissions and try again.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.';
          break;
        case 'aborted':
          errorMessage = 'Recording was aborted. Please try again.';
          shouldRetry = true;
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service is not available. Please try again in a moment.';
          shouldRetry = true;
          break;
        case 'bad-grammar':
          errorMessage = 'Grammar error. Please try again.';
          shouldRetry = true;
          break;
        default:
          errorMessage = `Speech recognition error: ${e.error}. Please try again.`;
          console.error('Unknown error type:', e);
          shouldRetry = true;
      }
      
      setError(errorMessage);
      setRecording(false);
      
      // Restart wake word detection on error
      if (recognitionRef.current && shouldRetry) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListeningForWakeWord(true);
          } catch (err) {
            console.warn('Failed to restart wake word detection:', err);
          }
        }, 1000);
      }
      
      // For retryable errors, show retry option
      if (shouldRetry && e.error === 'network') {
        console.log('Network error detected. Common causes:');
        console.log('1. Internet connection issues');
        console.log('2. Browser blocking the API');
        console.log('3. HTTPS requirement (though localhost should work)');
        console.log('4. Service temporarily unavailable');
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setRecording(false);
    };

    // Start recognition with error handling
    try {
      console.log('Attempting to start speech recognition...');
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        try {
          recognition.start();
          console.log('Speech recognition start() called successfully');
        } catch (startErr) {
          console.error('Failed to start recognition:', startErr);
          setError(`Failed to start recording: ${startErr.message}. Please try again or refresh the page.`);
          setRecording(false);
        }
      }, 100);
    } catch (err) {
      console.error('Failed to initialize recognition start:', err);
      setError(`Failed to start recording: ${err.message}. Please try again or refresh the page.`);
      setRecording(false);
      
      // Additional diagnostics
      console.error('Start error details:', {
        error: err,
        name: err.name,
        message: err.message,
        stack: err.stack,
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext
      });
    }
  };

  const handleManualSubmit = async () => {
    if (!entryText.trim()) {
      setError('Please enter some text');
      return;
    }

    if (!todayJournal) {
      setError('Please create today\'s journal first');
      return;
    }

    try {
      setError(null);
      await api.logVoiceEntry({
        text: entryText.trim(),
        timestamp: new Date().toISOString()
      });
      setSuccess(`Entry logged: "${entryText.trim()}"`);
      setEntryText('');
      setManualEntry(false);
      setTimeout(() => setSuccess(null), 3000);
      await loadTodayJournal();
      await loadJournalContent();
    } catch (err) {
      setError('Failed to log entry: ' + err.message);
    }
  };

  const handleCreateJournal = async () => {
    try {
      setLoading(true);
      const journal = await api.createJournal();
      setTodayJournal(journal);
      setError(null);
      await loadJournalContent();
      // Start wake word detection after journal is created
      startWakeWordDetection();
    } catch (err) {
      setError('Failed to create journal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Stop wake word detection
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      await api.logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/login');
    }
  };

  // Full screen recording overlay
  if (recording) {
    return (
      <div className="dashboard-container recording-fullscreen">
        <div className="voice-circle-container recording-fullscreen">
          <div className="voice-circle recording fullscreen">
            <div className="voice-circle-inner">
              <div className="recording-indicator"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>GoOrderly.ai</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="voice-section">
          {/* Circular visual instead of button */}
          <div className="voice-circle-container">
            <div className={`voice-circle ${recording ? 'recording' : ''} ${isListeningForWakeWord ? 'listening' : ''}`}>
              <div className="voice-circle-inner">
                {recording ? (
                  <div className="recording-indicator"></div>
                ) : (
                  <div className="sky-visual">
                    <div className="halo-ring-3"></div>
                  </div>
                )}
              </div>
            </div>
            <p className="disclaimer-text">
              Say <strong>"Hey Goorderly, I am going to grocery store right now"</strong>
            </p>
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          {success && <div className="success-message">{success}</div>}
          {!todayJournal && (
            <div className="info-message">
              💡 Create today's journal first to enable voice recording
            </div>
          )}
        </div>

        <div className="journal-section">
          <div className="journal-header">
            <h2>Today's Journal</h2>
            {!todayJournal && (
              <button
                className="create-btn"
                onClick={handleCreateJournal}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Today\'s Journal'}
              </button>
            )}
          </div>

          {loading && <div className="loading">Loading...</div>}

          {todayJournal && journalContent && (
            <div className="journal-content">
              <pre className="journal-text">{journalContent}</pre>
            </div>
          )}

          {todayJournal && !journalContent && !loading && (
            <div className="journal-link">
              <a
                href={todayJournal.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {todayJournal.name} →
              </a>
            </div>
          )}

          {!loading && !todayJournal && (
            <div className="no-journal">
              No journal created for today. Click "Create Today's Journal" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

