# college-data-server MCP Server

MCP server to provide access to Common Data Set (CDS) information and other college-related data.

This is a TypeScript-based MCP server that implements the Model Context Protocol (MCP) to allow language models to access college data information. It provides:

- Tools for searching college data
- Tools for retrieving Common Data Set (CDS) information from PDF and Excel files
- Automatic conversion of Excel files to PDF for processing with Gemini

## Features

### Tools
- `search_college_data` - Search for college data using Google Custom Search API
  - Takes a search query as parameter
  - Returns relevant search results about colleges

- `get_cds_data` - Retrieves and processes Common Data Set information
  - Takes college name and optional year as parameters
  - Parses PDF/XLSX files with Gemini to extract structured information
  - Caches results for improved performance

### Implementation Details
- Supports both PDF and XLSX (Excel) formats for CDS files
- Automatically converts XLSX files to PDF format for compatibility with Gemini API
- Extracts key information including admissions, expenses, and financial aid data
- Uses caching to avoid repeated processing of the same data

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "college-data-server": {
      "command": "/path/to/college-data-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Recent Updates

### XLSX to PDF Conversion
- Added support for converting Excel (.xlsx) files to PDF format
- This addresses compatibility issues with the Gemini API, which does not support the XLSX MIME type
- Implementation uses ExcelJS and PDFKit libraries to perform the conversion
- Provides a fallback mechanism when Gemini cannot process Excel files directly

### Tool Execution Enhancements
- Improved logging around tool execution to aid debugging
- Added detailed error handling for tool calls
- Enhanced logging of tool results with previews of response content

### Map Processing Improvements
- Restructured map enrichment to use chat history as reference rather than continuing conversations
- Modified prompts to provide explicit instructions for processing college locations sequentially
- Added state management to prevent duplicated tool calls when processing locations
- Improved handling of message history during map processing
