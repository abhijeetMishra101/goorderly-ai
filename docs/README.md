# GoOrderly.ai - System Diagrams

This directory contains Mermaid.js diagrams for visualizing the GoOrderly.ai system architecture and user workflows.

## Diagrams

### 1. User Workflow Diagram (`user-workflow-diagram.md`)
Sequence diagram showing the complete user journey from initial login through onboarding to daily usage.

**Key Workflows Covered:**
- Initial login with Google OAuth
- Template selection process
- Confirmation and preferences setup
- Voice entry logging
- Automated journal creation

### 2. Architecture Diagram (`architecture-diagram.md`)
System architecture diagram showing all components, their relationships, and data flow.

**Components Covered:**
- Frontend application (React)
- API Gateway (Express.js)
- Authentication layer
- Business logic services
- Database layer (PostgreSQL)
- External services (Google APIs)
- Infrastructure components

## Viewing the Diagrams

### GitHub
GitHub automatically renders Mermaid diagrams in markdown files. Simply view the files in the GitHub web interface.

### VS Code
Install the "Markdown Preview Mermaid Support" extension to view diagrams in VS Code.

### Online Viewer
Copy the Mermaid code to [Mermaid Live Editor](https://mermaid.live) for interactive viewing.

### Documentation Sites
Most documentation platforms (GitBook, Docusaurus, MkDocs) support Mermaid diagrams natively.

## Diagram Updates

When updating diagrams:
1. Keep them synchronized with actual code changes
2. Document new components/services
3. Update data flow paths when APIs change
4. Maintain clarity and readability

## Legend

- **Blue**: Frontend components
- **Purple**: Backend/API components
- **Green**: Database components
- **Orange**: External services
- **Pink**: Infrastructure components

