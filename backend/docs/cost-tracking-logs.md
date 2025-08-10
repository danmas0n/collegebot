# Cost Tracking Logs - Consolidated Location Guide

## Overview
All cost tracking logs have been consolidated to use the Winston logger and will appear in a single location: `backend/logs/combined.log`

## Log Location
**Primary Log File:** `backend/logs/combined.log`

This file contains all cost tracking logs with consistent formatting and prefixes to identify the source.

## Log Prefixes
All cost tracking logs now use consistent prefixes to identify their source:

- `Claude:` - All logs from the Claude service
- `Cost Calculator:` - All logs from the cost calculator service  
- `Flow Cost Tracker:` - All logs from the flow cost tracker service

## Key Log Types

### Claude Service Logs
- `Claude: Starting Claude stream` - When a new Claude request begins
- `Claude: Final usage data received` - When usage data is received from Claude API
- `Claude: Token Usage` - Simple token usage breakdown (input, output, cache tokens)
- `Claude: Flow completed` - When a chat flow is completed
- `Claude: Error tracking request cost` - Cost tracking errors

### Cost Calculator Logs
- `Gemini cost calculation` - Cost breakdown for Gemini requests  
- `OpenAI cost calculation` - Cost breakdown for OpenAI requests
- Note: Claude cost calculations are handled by flow-cost-tracker to avoid duplication

### Flow Cost Tracker Logs
- `Started flow cost tracking` - When a new flow begins
- `Added request to flow` - When a request is added to an active flow
- `Completed flow cost tracking` - When a flow is completed
- `Updating flow totals` - When flow totals are updated with new request data

## Log Format
All logs use structured JSON format with consistent fields:
```json
{
  "timestamp": "2025-01-09T23:06:47.123Z",
  "level": "info",
  "message": "Claude: Tracked request cost",
  "service": "collegebot",
  "environment": "development",
  "chatId": "chat-123",
  "stage": "recommendations",
  "model": "claude-3-5-sonnet-20241022",
  "usage": {...},
  "requestSequence": 1
}
```

## Viewing Logs
To view cost tracking logs in real-time:
```bash
# View all logs
tail -f backend/logs/combined.log

# View only cost tracking logs
tail -f backend/logs/combined.log | grep -E "(Claude:|Cost Calculator:|Flow Cost Tracker:)"

# View only cost-related logs
tail -f backend/logs/combined.log | grep -i cost
```

## Log Rotation
Logs are automatically rotated by Winston to prevent files from growing too large. Old logs are archived with timestamps.

## Debugging Cost Issues
1. Check `backend/logs/combined.log` for all cost tracking activity
2. Look for error messages with prefixes like "Claude: Error" or "Flow Cost Tracker: Error"
3. Search for specific chat IDs to trace the full cost tracking flow
4. Use the structured JSON format to filter and analyze cost data

## Console Logs Eliminated
The following console log statements have been replaced with Winston logger:
- All `console.log`, `console.info`, `console.error` statements in cost tracking code
- Separate `claudeLogger` instance (now uses main logger with "Claude:" prefix)
- Mixed logging patterns across different services

## Benefits of Consolidation
- Single location for all cost tracking logs
- Consistent log format and structure
- Better searchability and filtering
- Proper log rotation and archiving
- Structured data for analysis
- Clear service identification with prefixes
