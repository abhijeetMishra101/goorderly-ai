# GoOrderly.ai - Architecture Diagrams

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "User Browser"
        FE[React Frontend]
    end

    subgraph "Node.js API Server"
        API[Express API]
        AUTH[Auth Service]
        DRIVE[Drive Service]
        APPS[Apps Script Service]
        LLM_SVC[LLM Service]
        JOURN[Journal Service]
    end

    subgraph "Database"
        PG[(PostgreSQL)]
    end

    subgraph "Google Cloud"
        OAUTH[Google OAuth]
        DRIVE_API[Google Drive API]
        APPS_API[Apps Script API]
        DOCS[Google Docs]
        CAL[Google Calendar]
        GMAIL[Gmail API]
    end

    subgraph "User's Google Drive"
        USER_SCRIPT[User's Apps Script]
        USER_DOCS[User's Journal Docs]
        USER_FOLDER[Journal Folder]
    end

    subgraph "Self-Hosted LLM"
        M1[M1 Mac]
        OLLAMA[Ollama Server]
        NGROK[ngrok Tunnel]
    end

    FE -->|OAuth Login| OAUTH
    OAUTH -->|Tokens| AUTH
    AUTH -->|Store| PG
    
    FE -->|API Calls| API
    API --> AUTH
    API --> DRIVE
    API --> APPS
    API --> LLM_SVC
    API --> JOURN
    
    AUTH -->|User Data| PG
    APPS -->|Create Script| APPS_API
    APPS_API -->|Script File| USER_SCRIPT
    
    DRIVE -->|Read/Write| DRIVE_API
    DRIVE_API -->|Documents| DOCS
    DRIVE_API -->|Events| CAL
    
    USER_SCRIPT -->|Create Docs| USER_DOCS
    USER_SCRIPT -->|Create Events| CAL
    USER_SCRIPT -->|Send Emails| GMAIL
    USER_SCRIPT -->|Webhook| API
    
    LLM_SVC -->|API Calls| NGROK
    NGROK -->|Proxy| OLLAMA
    OLLAMA -->|Inference| M1
    
    JOURN -->|Update Docs| DRIVE_API
    DRIVE_API -->|Documents| USER_DOCS

    style FE fill:#ADD8E6
    style API fill:#DDA0DD
    style PG fill:#90EE90
    style USER_SCRIPT fill:#FFD700
    style M1 fill:#FFB6C1
```

## 2. Onboarding Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Node.js API
    participant DB as PostgreSQL
    participant GoogleAuth as Google OAuth
    participant DriveAPI as Google Drive API
    participant AppsScriptAPI as Apps Script API
    participant UserScript as User's Apps Script

    User->>Frontend: 1. Access GoOrderly.ai
    Frontend->>API: Check auth status
    API->>DB: Query user
    alt Not Authenticated
        DB-->>API: No user found
        API-->>Frontend: 401 Unauthorized
        Frontend->>User: Show Login Page
        User->>Frontend: Click "Continue with Google"
        Frontend->>GoogleAuth: OAuth redirect
        GoogleAuth->>User: Login & Permissions
        User->>GoogleAuth: Grant permissions
        GoogleAuth->>API: Callback with code
        API->>GoogleAuth: Exchange code for tokens
        GoogleAuth-->>API: Access & Refresh tokens
        API->>DB: Create/Update user
        DB-->>API: User created
        API->>API: Generate JWT
        API-->>Frontend: Redirect with JWT token
    end

    Frontend->>API: GET /api/onboarding/status
    API->>DB: Check onboarding
    alt Onboarding Incomplete
        DB-->>API: No template selected
        API-->>Frontend: {isComplete: false}
        Frontend->>User: Show Template Selection
        User->>Frontend: Select template
        Frontend->>API: POST /api/onboarding/select-template
        API->>DB: Save template selection
        Frontend->>User: Show Confirmation Page
        User->>Frontend: Set preferences (folder, time)
        Frontend->>API: POST /api/onboarding/confirm
        API->>DB: Save preferences
        
        Note over API,AppsScriptAPI: NEW: Create Apps Script
        API->>AppsScriptAPI: Create script file
        AppsScriptAPI->>DriveAPI: Create .gs file
        DriveAPI-->>AppsScriptAPI: Script file ID
        AppsScriptAPI->>AppsScriptAPI: Inject user preferences
        AppsScriptAPI->>AppsScriptAPI: Deploy as web app
        AppsScriptAPI-->>API: Script ID & Web App URL
        API->>DB: Save script info
        
        Note over UserScript: Script sets up triggers automatically
        UserScript->>UserScript: setupTriggersStartingTomorrow()
        UserScript->>UserScript: setupAnalysisTriggers()
        
        API-->>Frontend: Onboarding complete
        Frontend->>User: Redirect to Dashboard
    end
```

## 3. Daily Automated Journal Creation (Apps Script)

```mermaid
sequenceDiagram
    participant Trigger as Time Trigger
    participant UserScript as User's Apps Script
    participant DriveAPI as Google Drive API
    participant DocsAPI as Google Docs API
    participant CalendarAPI as Google Calendar API
    participant GmailAPI as Gmail API
    participant User

    Note over Trigger,User: Daily at 6:00 AM (user configured)
    Trigger->>UserScript: Trigger createDailyJournalAndCalendarEvent()
    
    UserScript->>DriveAPI: Get or create journal folder
    DriveAPI-->>UserScript: Folder ID
    
    UserScript->>DriveAPI: Copy template document
    DriveAPI->>DocsAPI: Duplicate template
    DocsAPI-->>DriveAPI: New document ID
    DriveAPI-->>UserScript: Journal document created
    
    UserScript->>DocsAPI: Replace {DATE} placeholder
    DocsAPI-->>UserScript: Document updated
    
    UserScript->>CalendarAPI: Create calendar event
    CalendarAPI-->>UserScript: Event created
    
    UserScript->>UserScript: Store doc ID in properties
    
    Note over Trigger,User: Every Hour After Creation
    Trigger->>UserScript: Trigger checkIfJournalFilled()
    
    UserScript->>DocsAPI: Get document content
    DocsAPI-->>UserScript: Document text
    
    UserScript->>UserScript: Compare with template length
    
    alt Journal Not Filled
        UserScript->>GmailAPI: Send reminder email
        GmailAPI->>User: Email reminder
    end
    
    Note over Trigger,User: Daily at 12:00 AM
    Trigger->>UserScript: Trigger analyzeYesterdayJournal()
    
    UserScript->>DocsAPI: Get yesterday's journal
    DocsAPI-->>UserScript: Journal content
    
    UserScript->>UserScript: Parse and analyze content
    
    UserScript->>GmailAPI: Send analysis email
    GmailAPI->>User: Analysis report
```

## 4. Voice Entry Processing Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Node.js API
    participant LLM as LLM Service
    participant Ollama as Ollama/M1 Mac
    participant SmartRouter as Smart Router
    participant DriveAPI as Google Drive API
    participant DocsAPI as Google Docs API
    participant UserScript as User's Apps Script

    User->>Frontend: Click "Start Recording"
    Frontend->>Frontend: Web Speech API captures voice
    User->>Frontend: Speak: "I am going to grocery store"
    Frontend->>Frontend: Convert speech to text
    Frontend->>API: POST /api/journal/voice-entry<br/>{text, timestamp, lat, lng}
    
    API->>API: Validate input
    
    Note over API,SmartRouter: Smart Routing Logic
    API->>SmartRouter: Process entry
    SmartRouter->>SmartRouter: Try regex/rules detection
    
    alt Simple Pattern Detected (80% cases)
        SmartRouter->>SmartRouter: Extract via regex
        SmartRouter-->>API: {context: "errand", timeSlot: inferred}
        Note over SmartRouter: No LLM call - instant!
    else Ambiguous Entry (20% cases)
        SmartRouter->>LLM: Call LLM API
        LLM->>NGROK: POST to ngrok URL
        NGROK->>Ollama: API request
        Ollama->>Ollama: LLM inference (Llama 3.2)
        Ollama-->>NGROK: JSON response
        NGROK-->>LLM: Structured data
        LLM-->>SmartRouter: {timeSlot, context, location}
        SmartRouter-->>API: Extracted data
    end
    
    API->>API: Format entry text
    
    API->>DriveAPI: Find today's journal
    DriveAPI-->>API: Journal document ID
    
    API->>DocsAPI: Find time slot in document
    DocsAPI-->>API: Slot position
    
    API->>DocsAPI: Insert entry at time slot
    DocsAPI-->>API: Entry added
    
    API-->>Frontend: Success response
    Frontend->>User: Show "Entry logged" confirmation
```

## 5. LLM Service Architecture

```mermaid
graph LR
    subgraph "Node.js API"
        VOICE[Voice Entry]
        ROUTER[Smart Router]
        REGEX[Regex Detector]
        LLM_CLIENT[LLM Client]
    end

    subgraph "Smart Routing"
        CHECK{Simple Pattern?}
        REGEX -->|Yes 80%| INSTANT[Instant Response]
        REGEX -->|No 20%| LLM_CLIENT
    end

    subgraph "M1 Mac Self-Hosted"
        NGROK[ngrok Tunnel]
        OLLAMA[Ollama Server]
        MODEL[Llama 3.2 8B Q4]
    end

    subgraph "Response"
        JSON[JSON Response]
        PARSED[Parsed Data]
    end

    VOICE --> ROUTER
    ROUTER --> CHECK
    CHECK -->|Simple| REGEX
    CHECK -->|Complex| LLM_CLIENT
    
    LLM_CLIENT -->|HTTPS| NGROK
    NGROK -->|Proxy| OLLAMA
    OLLAMA -->|Inference| MODEL
    MODEL -->|Tokens| OLLAMA
    OLLAMA -->|JSON| NGROK
    NGROK -->|Response| LLM_CLIENT
    
    INSTANT --> JSON
    LLM_CLIENT --> JSON
    JSON --> PARSED

    style MODEL fill:#FFB6C1
    style OLLAMA fill:#DDA0DD
    style NGROK fill:#90EE90
```

## 6. Apps Script Creation Process

```mermaid
sequenceDiagram
    participant API as Node.js API
    participant DB as Database
    participant AppsScriptAPI as Apps Script API
    participant DriveAPI as Google Drive API
    participant UserScript as User's Apps Script
    participant Triggers as Google Triggers

    API->>DB: User completes onboarding
    DB-->>API: User preferences
    
    API->>API: Load Apps Script template
    API->>API: Inject user preferences:<br/>- Template ID<br/>- Folder name<br/>- Journal time<br/>- LLM API URL
    
    API->>AppsScriptAPI: Create script project
    AppsScriptAPI-->>API: Project ID
    
    API->>AppsScriptAPI: Upload script code
    AppsScriptAPI-->>API: Script file ID
    
    API->>DriveAPI: Move script to user's Drive
    DriveAPI-->>API: File moved
    
    API->>AppsScriptAPI: Deploy as web app
    AppsScriptAPI-->>API: Web app URL
    
    API->>AppsScriptAPI: Authorize script
    AppsScriptAPI-->>API: Authorization complete
    
    API->>AppsScriptAPI: Execute setup function
    AppsScriptAPI->>UserScript: Run setupTriggersStartingTomorrow()
    
    UserScript->>Triggers: Create daily trigger (6 AM)
    UserScript->>Triggers: Create hourly trigger
    UserScript->>Triggers: Create daily analysis trigger (midnight)
    UserScript->>Triggers: Create weekly trigger (Monday)
    UserScript->>Triggers: Create monthly trigger (1st)
    
    Triggers-->>UserScript: Triggers created
    
    API->>DB: Save script ID & web app URL
    DB-->>API: Saved
    
    API-->>API: Onboarding complete
```

## 7. Data Flow - Complete System

```mermaid
graph TD
    subgraph "User Actions"
        LOGIN[Login]
        SELECT[Select Template]
        VOICE[Voice Entry]
    end

    subgraph "Node.js API"
        AUTH[Authentication]
        ONBOARD[Onboarding]
        APPS_CREATE[Apps Script Creation]
        VOICE_PROC[Voice Processing]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
        USER_DRIVE[User's Google Drive]
    end

    subgraph "Automation"
        USER_SCRIPT[User's Apps Script]
        TRIGGERS[Time Triggers]
    end

    subgraph "AI Processing"
        LLM[LLM Service]
        OLLAMA[Ollama/M1 Mac]
    end

    subgraph "Google Services"
        DRIVE[Drive API]
        DOCS[Docs API]
        CAL[Calendar API]
        EMAIL[Gmail API]
    end

    LOGIN --> AUTH
    AUTH --> DB
    SELECT --> ONBOARD
    ONBOARD --> APPS_CREATE
    APPS_CREATE --> USER_SCRIPT
    APPS_CREATE --> USER_DRIVE
    
    VOICE --> VOICE_PROC
    VOICE_PROC --> LLM
    LLM --> OLLAMA
    OLLAMA --> LLM
    LLM --> VOICE_PROC
    VOICE_PROC --> DRIVE
    
    TRIGGERS --> USER_SCRIPT
    USER_SCRIPT --> DRIVE
    USER_SCRIPT --> DOCS
    USER_SCRIPT --> CAL
    USER_SCRIPT --> EMAIL
    
    USER_SCRIPT --> USER_DRIVE
    DRIVE --> USER_DRIVE

    style USER_SCRIPT fill:#FFD700
    style OLLAMA fill:#FFB6C1
    style DB fill:#90EE90
```

