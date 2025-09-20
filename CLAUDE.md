# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Python FastAPI)
```bash
# Development
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload

# Run backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend (React + Vite)
```bash
# Development
cd frontend
npm install
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Update API Documentation
```bash
./scripts/update_llms.sh  # Refreshes docs/llms.txt from Longbridge OpenAPI
```

## Important Guidelines

**CRITICAL**: When implementing any Longbridge OpenAPI calls, ALWAYS reference `docs/llms.txt` for the official API documentation. This file contains the canonical API specifications and must be consulted before making any external API calls.

## Architecture Overview

This is a full-stack quantitative trading system for Longbridge OpenAPI integration:

### Backend (`/backend`)
- **Framework**: FastAPI with async support
- **Database**: DuckDB for local persistence (`data/quant.db`)
- **Security**: Fernet encryption for sensitive credentials
- **Key Components**:
  - `app/main.py`: FastAPI application entry point
  - `app/services.py`: Core business logic for quotes and trading
  - `app/streaming.py`: WebSocket connections for real-time data
  - `app/repositories.py`: Database access layer
  - `app/routers/`: API endpoints (settings, quotes, portfolio)
  - `app/models.py`: Pydantic models for data validation

### Frontend (`/frontend`)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **Key Components**:
  - `src/pages/`: Main application pages
  - `src/api/`: Backend API client
  - `src/components/`: Reusable UI components

### API Integration
- The system integrates with Longbridge OpenAPI for trading and market data
- API documentation is stored in `docs/llms.txt` (canonical LLM-friendly format)
- Requires Longbridge account credentials (APP_KEY, APP_SECRET, ACCESS_TOKEN)

### Data Flow
1. Frontend sends configuration/requests to backend API
2. Backend stores credentials (encrypted) and settings in DuckDB
3. Backend connects to Longbridge OpenAPI for real-time quotes and trading
4. Real-time data pushed to frontend via WebSocket connections

## Environment Variables

### Backend
- `DATA_DIR`: Directory for database and encryption key (default: `../data`)
- `DUCKDB_PATH`: Full path to DuckDB file (default: `../data/quant.db`)
- `LONGPORT_APP_KEY`: Longbridge API key
- `LONGPORT_APP_SECRET`: Longbridge API secret
- `LONGPORT_ACCESS_TOKEN`: Longbridge access token

### Frontend
- `VITE_API_BASE`: Backend API URL (default: `http://localhost:8000`)

## Rate Limits (Longbridge OpenAPI)
- Quote API: ≤10 calls/sec, ≤5 concurrent requests, ≤500 subscriptions
- Trade API: ≤30 calls per 30 seconds with ≥0.02s between calls