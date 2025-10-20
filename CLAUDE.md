# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Python FastAPI)
```bash
# Initial setup
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .

# Development server
uvicorn app.main:app --reload

# Production server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Utility scripts (run from backend directory)
python sync_candlesticks.py          # Sync historical candlestick data
python update_symbols.py             # Update symbol subscriptions
python start_realtime_stream.py      # Start real-time quote stream
python test_websocket.py             # Test WebSocket connection
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

### Maintenance
```bash
# Update Longbridge API documentation
./scripts/update_llms.sh

# Backup database
cp data/quant.db backup/quant_$(date +%Y%m%d).db
```

## Important Guidelines

**CRITICAL**: When implementing any Longbridge OpenAPI calls, ALWAYS reference `docs/llms.txt` for the official API documentation. This file contains the canonical API specifications and must be consulted before making any external API calls.

**Language**: All user-facing messages and responses should default to Chinese (中文) unless otherwise specified.

## Architecture Overview

This is a full-stack **intelligent automated trading system** for Longbridge OpenAPI integration with:

- **Multi-factor signal analysis** engine for optimal buy/sell point identification
- **Automated trading strategies** with real-time signal execution
- **Position monitoring** with dynamic stop-loss/take-profit management
- **Real-time market data streaming** via WebSocket
- **Local DuckDB storage** for historical data and strategy state

### Backend (`/backend`)
**Framework**: FastAPI with async support

**Key Components**:
- `app/main.py`: FastAPI application entry point, router registration, startup/shutdown lifecycle
- `app/optimal_trading_signals.py`: Multi-factor signal analysis engine (11 factors) for buy/sell recommendations
- `app/strategy_engine.py`: Automated strategy execution engine with 5 pre-configured strategies (MA Crossover, RSI, Breakout, Bollinger Bands, MACD)
- `app/trading_api.py`: Longbridge Trading API wrapper for order execution
- `app/position_monitor.py`: Real-time position monitoring and risk management system
- `app/streaming.py`: WebSocket manager for real-time quote streaming
- `app/notification_manager.py`: Event notification system (WebSocket + logs)
- `app/services.py`: Core business logic for quotes, positions, and calculations
- `app/repositories.py`: DuckDB data access layer with Fernet encryption
- `app/models.py`: Pydantic models for data validation
- `app/db.py`: Database initialization and connection management
- `app/config.py`: Settings and environment configuration

**API Routers** (`app/routers/`):
- `settings.py`: Credentials and configuration management
- `quotes.py`: Real-time quotes and historical data
- `portfolio.py`: Holdings and account balance
- `strategies.py`: Strategy control and execution
- `monitoring.py`: Position monitoring and risk management
- `signal_analysis.py`: Intelligent signal analysis APIs
- `notifications.py`: Event notifications and alerts

**Database**: DuckDB (`data/quant.db`) with tables:
- `settings`: Encrypted credentials and configuration
- `symbols`: Stock subscriptions
- `ohlc`: Historical candlestick data
- `ticks`: Real-time tick data
- `signals`: Trading signals with confidence scores
- `orders`: Order history and status
- `positions`: Current holdings

**Security**: Fernet encryption for sensitive credentials stored in DuckDB

### Frontend (`/frontend`)
**Framework**: React 18 + TypeScript + Vite

**UI Libraries**: Material-UI (MUI) + Tailwind CSS + charting libraries (G2, lightweight-charts, klinecharts)

**Pages** (`src/pages/`):
- `Settings.tsx`: Longbridge credentials configuration and stock subscriptions
- `Realtime.tsx`: Real-time quote monitoring with WebSocket
- `RealtimeKLine.tsx`: Real-time candlestick charts with technical indicators
- `History.tsx`: Historical data query and analysis
- `StrategyControl.tsx`: Strategy enable/disable and parameter configuration
- `SignalAnalysis.tsx`: Intelligent signal analysis and market overview
- `PositionMonitoring.tsx`: Real-time position monitoring and risk parameters

**API Client** (`src/api/`):
- `client.ts`: Base API client configuration
- `quotes.ts`: Quote-related API endpoints

### Data Flow
1. **Configuration**: Frontend submits credentials → Backend validates and encrypts → Stored in DuckDB
2. **Historical Data**: Backend syncs historical candlesticks → Stored in `ohlc` table → Available for backtesting and analysis
3. **Real-time Quotes**: Longbridge WebSocket → Backend `streaming.py` → Frontend via `/ws/quotes`
4. **Signal Analysis**: Historical data + real-time quotes → Multi-factor analysis → Buy/sell signals with confidence scores
5. **Strategy Execution**: Strategy engine monitors signals → Auto-executes orders via Trading API → Position monitor tracks risk
6. **Position Monitoring**: Real-time P&L calculation → Risk management → Stop-loss/take-profit triggers

### Trading Strategy System

**5 Pre-configured Strategies**:
1. **MA Crossover** (均线交叉): Golden cross/death cross signals
2. **RSI Oversold** (RSI超卖): Oversold bounce opportunities
3. **Breakout** (突破): Key resistance level breakouts
4. **Bollinger Bands** (布林带): Mean reversion strategy
5. **MACD Divergence** (MACD背离): Trend reversal signals

**Signal Analysis Engine** (`optimal_trading_signals.py`):
- **Buy Factors (6)**: Trend consistency, momentum, mean reversion, volume confirmation, support/resistance, market sentiment
- **Sell Factors (5)**: Profit-taking, trend reversal, momentum divergence, resistance rejection, risk management
- **Confidence Scoring**: 0-1 score with 5-level signal strength classification

## Environment Variables

### Backend
Create a `.env` file in the backend directory:

```bash
# Longbridge API Credentials (required)
LONGPORT_APP_KEY=your-app-key
LONGPORT_APP_SECRET=your-app-secret
LONGPORT_ACCESS_TOKEN=your-access-token

# Optional: Region (for mainland China accounts)
# LONGPORT_REGION=cn

# Optional: Data storage paths
# DATA_DIR=../data
# DUCKDB_PATH=../data/quant.db
```

**⚠️ Security**: These credentials have real trading permissions. Never commit them to version control.

### Frontend
```bash
# Backend API URL (optional, default: http://localhost:8000)
VITE_API_BASE=http://localhost:8000
```

## Rate Limits (Longbridge OpenAPI)
- **Quote API**: ≤10 calls/sec, ≤5 concurrent requests, ≤500 subscriptions
- **Trade API**: ≤30 calls per 30 seconds with ≥0.02s between calls

## Development Workflow

### Testing API Connection
```bash
# Check health endpoint
curl http://localhost:8000/health

# Verify credentials
curl http://localhost:8000/settings/credentials

# Check quote stream status
curl http://localhost:8000/quotes/stream/status

# Get market overview from signal analysis
curl http://localhost:8000/signals/market_overview
```

### Real-time Debugging
- Backend logs: Monitor strategy execution, trading events, and errors
- Frontend DevTools: WebSocket connection status and API requests
- WebSocket endpoint: `ws://localhost:8000/ws/quotes` for real-time quote stream

### Database Management
```bash
# Access DuckDB CLI (from backend directory)
source .venv/bin/activate
python -c "import duckdb; duckdb.connect('../data/quant.db').execute('SHOW TABLES').fetchall()"

# Query recent signals
python -c "import duckdb; print(duckdb.connect('../data/quant.db').execute('SELECT * FROM signals ORDER BY ts DESC LIMIT 10').fetchdf())"
```

## Project Structure Notes

- **Standalone utility scripts** in `backend/`: These are helper scripts for data sync, testing, and debugging (not part of the main FastAPI app)
- **docs/llms.txt**: Auto-generated from Longbridge OpenAPI documentation. Update via `./scripts/update_llms.sh`
- **docs/rules.md**: Project conventions and implementation decisions (in Chinese)
- **Multiple chart libraries**: The frontend uses different chart libraries for different use cases (G2 for general charts, lightweight-charts for performance, klinecharts for advanced features)

## Common Issues

### WebSocket Connection Fails
- Ensure backend is running on correct port (8000)
- Check firewall settings allow WebSocket connections
- Review browser console for connection errors

### Trading Execution Fails
- Verify Longbridge API credentials are valid and not expired
- Check account balance and trading permissions
- Review backend logs for specific error messages from Longbridge API

### Signal Analysis Shows No Results
- Ensure sufficient historical data is loaded (run `sync_candlesticks.py`)
- Verify stock symbol format is correct (e.g., `AAPL.US`, `700.HK`, `000001.SZ`)
- Check if market is open (some data may be delayed or unavailable outside trading hours)
