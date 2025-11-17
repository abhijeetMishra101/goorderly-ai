# GoOrderly.ai - Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser<br/>React Frontend]
        MOBILE[Mobile Browser<br/>PWA]
    end
    
    subgraph "Frontend Application"
        LOGIN[Login Page<br/>Google OAuth]
        TEMPLATES[Template Selection<br/>Page]
        CONFIRM[Confirmation Page<br/>Preferences]
        DASHBOARD[Dashboard<br/>Voice Logging UI]
        API_CLIENT[API Client<br/>Axios/Fetch]
    end
    
    subgraph "API Gateway"
        EXPRESS[Express.js Server<br/>Port 3000]
        CORS[CORS Middleware]
        AUTH_MW[Auth Middleware<br/>JWT Validation]
    end
    
    subgraph "Authentication Layer"
        OAUTH_ROUTES[Auth Routes<br/>/api/auth/*]
        OAUTH_SERVICE[Google Auth Service<br/>Token Management]
        JWT[JWT Token<br/>Generation/Validation]
    end
    
    subgraph "Application Layer"
        JOURNAL_ROUTES[Journal Routes<br/>/api/journal/*]
        TEMPLATE_ROUTES[Template Routes<br/>/api/templates/*]
        ONBOARDING_ROUTES[Onboarding Routes<br/>/api/onboarding/*]
    end
    
    subgraph "Business Logic Layer"
        JOURNAL_SERVICE[Journal Service<br/>Business Logic]
        TEMPLATE_SERVICE[Template Service<br/>CRUD Operations]
        ONBOARDING_SERVICE[Onboarding Service<br/>Template Selection]
        DRIVE_SERVICE[Google Drive Service<br/>Drive API Wrapper]
        PARSER[Journal Parser<br/>Content Analysis]
        CONTEXT[Context Detector<br/>Intent Recognition]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL Database)]
        USERS_TABLE[(users<br/>OAuth tokens)]
        TEMPLATES_TABLE[(templates<br/>Template metadata)]
        USER_TEMPLATES_TABLE[(user_templates<br/>User preferences)]
        SEQUELIZE[Sequelize ORM]
    end
    
    subgraph "External Services"
        GOOGLE_OAUTH[Google OAuth2<br/>Authentication]
        GOOGLE_DRIVE[Google Drive API<br/>Document Storage]
        GOOGLE_DOCS[Google Docs API<br/>Document Operations]
        GOOGLE_CALENDAR[Google Calendar API<br/>Event Creation]
        GMAIL[Gmail API<br/>Email Notifications]
    end
    
    subgraph "Infrastructure"
        CRON[Cron Jobs<br/>Scheduled Tasks]
        LOGGER[Winston Logger<br/>Error Logging]
        ENV[Environment Variables<br/>.env Config]
    end
    
    %% Client to Frontend
    WEB --> LOGIN
    WEB --> TEMPLATES
    WEB --> CONFIRM
    WEB --> DASHBOARD
    MOBILE --> LOGIN
    MOBILE --> DASHBOARD
    
    %% Frontend to API
    LOGIN --> API_CLIENT
    TEMPLATES --> API_CLIENT
    CONFIRM --> API_CLIENT
    DASHBOARD --> API_CLIENT
    API_CLIENT --> EXPRESS
    
    %% API Gateway
    EXPRESS --> CORS
    CORS --> AUTH_MW
    
    %% Routes
    AUTH_MW --> OAUTH_ROUTES
    AUTH_MW --> JOURNAL_ROUTES
    AUTH_MW --> TEMPLATE_ROUTES
    AUTH_MW --> ONBOARDING_ROUTES
    
    %% Authentication Flow
    OAUTH_ROUTES --> OAUTH_SERVICE
    OAUTH_SERVICE --> JWT
    OAUTH_SERVICE --> GOOGLE_OAUTH
    OAUTH_SERVICE --> USERS_TABLE
    
    %% Journal Flow
    JOURNAL_ROUTES --> JOURNAL_SERVICE
    JOURNAL_SERVICE --> DRIVE_SERVICE
    JOURNAL_SERVICE --> ONBOARDING_SERVICE
    JOURNAL_SERVICE --> PARSER
    JOURNAL_SERVICE --> CONTEXT
    
    %% Template Flow
    TEMPLATE_ROUTES --> TEMPLATE_SERVICE
    TEMPLATE_SERVICE --> TEMPLATES_TABLE
    
    %% Onboarding Flow
    ONBOARDING_ROUTES --> ONBOARDING_SERVICE
    ONBOARDING_SERVICE --> TEMPLATE_SERVICE
    ONBOARDING_SERVICE --> USER_TEMPLATES_TABLE
    
    %% Data Access
    TEMPLATE_SERVICE --> SEQUELIZE
    ONBOARDING_SERVICE --> SEQUELIZE
    OAUTH_SERVICE --> SEQUELIZE
    SEQUELIZE --> POSTGRES
    POSTGRES --> USERS_TABLE
    POSTGRES --> TEMPLATES_TABLE
    POSTGRES --> USER_TEMPLATES_TABLE
    
    %% External API Calls
    DRIVE_SERVICE --> GOOGLE_DRIVE
    DRIVE_SERVICE --> GOOGLE_DOCS
    DRIVE_SERVICE --> GOOGLE_CALENDAR
    OAUTH_SERVICE --> GOOGLE_OAUTH
    JOURNAL_SERVICE --> GMAIL
    
    %% Infrastructure
    CRON --> JOURNAL_SERVICE
    EXPRESS --> LOGGER
    EXPRESS --> ENV
    
    %% Styling
    classDef frontend fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef database fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef infra fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    
    class WEB,MOBILE,LOGIN,TEMPLATES,CONFIRM,DASHBOARD,API_CLIENT frontend
    class EXPRESS,OAUTH_ROUTES,JOURNAL_ROUTES,TEMPLATE_ROUTES,ONBOARDING_ROUTES,JOURNAL_SERVICE,TEMPLATE_SERVICE,ONBOARDING_SERVICE,DRIVE_SERVICE,PARSER,CONTEXT,OAUTH_SERVICE,JWT backend
    class POSTGRES,USERS_TABLE,TEMPLATES_TABLE,USER_TEMPLATES_TABLE,SEQUELIZE database
    class GOOGLE_OAUTH,GOOGLE_DRIVE,GOOGLE_DOCS,GOOGLE_CALENDAR,GMAIL external
    class CRON,LOGGER,ENV infra
```

## Component Descriptions

### Client Layer
- **Web Browser**: Desktop/laptop users accessing via React web app
- **Mobile Browser**: Mobile users accessing via PWA

### Frontend Application
- **Login Page**: Google OAuth authentication entry point
- **Template Selection**: User chooses their journal template
- **Confirmation Page**: User reviews and sets preferences
- **Dashboard**: Main interface for voice logging and journal access
- **API Client**: Handles all HTTP requests to backend

### API Gateway
- **Express.js Server**: Main HTTP server handling all requests
- **CORS Middleware**: Enables cross-origin requests
- **Auth Middleware**: Validates JWT tokens for protected routes

### Authentication Layer
- **Auth Routes**: Handle OAuth flow and user sessions
- **Google Auth Service**: Manages OAuth token lifecycle
- **JWT**: Session token generation and validation

### Application Layer
- **Journal Routes**: CRUD operations for journals
- **Template Routes**: Template listing and details
- **Onboarding Routes**: Template selection and confirmation

### Business Logic Layer
- **Journal Service**: Core journaling logic
- **Template Service**: Template management
- **Onboarding Service**: User onboarding flow
- **Drive Service**: Google Drive API wrapper
- **Parser**: Analyzes journal content
- **Context Detector**: Detects intent from voice entries

### Data Layer
- **PostgreSQL**: Primary database
- **Sequelize ORM**: Database abstraction layer
- **Tables**: users, templates, user_templates

### External Services
- **Google APIs**: OAuth, Drive, Docs, Calendar, Gmail

### Infrastructure
- **Cron Jobs**: Scheduled journal creation
- **Logger**: Error and activity logging
- **Environment Variables**: Configuration management

