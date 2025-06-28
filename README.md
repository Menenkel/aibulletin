# Experimental AI Drought Bulletins

A full-stack web application that crawls multiple sources to generate comprehensive drought and food security analysis using AI. The application combines web scraping, PDF processing, and OpenAI GPT-4o-mini to create structured drought bulletins.

## Features

- **Multi-source Crawling**: Crawls web pages and PDF documents from various sources
- **AI-Powered Analysis**: Uses OpenAI GPT-4o-mini to generate structured drought analysis
- **PDF Support**: Automatically detects and processes PDF URLs using PyPDF2
- **Recursive Crawling**: Optional link following with configurable depth
- **Persistent Storage**: Saves API keys, URLs, and custom prompts
- **World Bank Regions**: Supports region-specific analysis using World Bank classifications
- **Modern UI**: React frontend with Ant Design components and responsive design
- **Progress Tracking**: Visual progress indicators during crawling and analysis

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **OpenAI GPT-4o-mini**: AI analysis and summarization
- **PyPDF2**: PDF text extraction
- **BeautifulSoup**: Web scraping and HTML parsing
- **Requests**: HTTP client for web crawling
- **Uvicorn**: ASGI server

### Frontend
- **React**: Frontend framework
- **Vite**: Build tool and dev server
- **Ant Design**: UI component library
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library

## Project Structure

```
Drought_Bulletin_webcrawler/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── storage.py          # Data persistence utilities
│   ├── world_bank_regions.py # Region loading utilities
│   └── data/               # Data storage directory
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── main.jsx        # React entry point
│   │   └── components/     # UI components
│   ├── package.json        # Node.js dependencies
│   └── vite.config.js      # Vite configuration
├── data/
│   └── world_bank_regions.csv # World Bank region mappings
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- OpenAI API key

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create API key file:
   ```bash
   mkdir -p data
   echo '{"api_key": "your-openai-api-key-here"}' > data/api_key.json
   ```

5. Start the backend server:
   ```bash
   python main.py
   ```

The backend will run on `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

## Usage

1. **Set API Key**: Enter your OpenAI API key in the settings
2. **Select Region**: Choose a World Bank region for analysis
3. **Add URLs**: Enter URLs to crawl (supports both web pages and PDFs)
4. **Customize Prompt**: Modify the analysis prompt if needed
5. **Configure Crawling**: Set link following and depth options
6. **Generate Analysis**: Click "Analyze" to start the process

## API Endpoints

- `GET /`: Root endpoint
- `GET /regions`: Get available World Bank regions
- `GET /api-key/status`: Check API key status
- `POST /api-key`: Set API key
- `GET /saved-urls`: Get saved URLs and settings
- `POST /saved-urls`: Save URLs and settings
- `POST /crawl-and-summarize`: Main analysis endpoint

## Analysis Structure

The AI generates structured analysis with the following sections:
- **Current Drought Conditions**: Overview of drought severity and affected areas
- **Food Security and Production**: Impact on agriculture and food availability
- **Water Resources**: Water availability and management issues
- **Food Prices**: Price trends and market impacts

## Supported Sources

The application can crawl various sources including:
- FEWS NET reports and bulletins
- FAO food security updates
- World Bank agriculture briefs
- NOAA drought monitoring data
- Crop monitoring reports
- And many other drought and food security related sources

## PDF Processing

The application automatically detects PDF URLs and:
- Downloads PDF files
- Extracts text content using PyPDF2
- Processes the text through the AI analysis pipeline
- Handles errors gracefully for corrupted or inaccessible PDFs

## Security Features

- API keys are stored locally and not committed to version control
- GitHub push protection prevents accidental exposure of secrets
- Comprehensive `.gitignore` prevents sensitive files from being tracked

## Development

### Adding New Features
1. Backend changes: Modify `backend/main.py`
2. Frontend changes: Modify `frontend/src/App.jsx`
3. Test changes locally before committing

### Environment Variables
- No environment variables required for basic setup
- API keys are stored in `backend/data/api_key.json`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for experimental and research purposes. Please ensure compliance with the terms of service for all data sources and APIs used.

## Support

For issues and questions:
1. Check the GitHub issues page
2. Review the setup instructions
3. Ensure all dependencies are properly installed
4. Verify API key configuration

## Acknowledgments

- OpenAI for providing the GPT-4o-mini API
- FEWS NET for drought and food security data
- World Bank for regional classifications
- FAO for food security information
- NOAA for drought monitoring data # Last updated: Fri Jun 27 21:14:39 EDT 2025
