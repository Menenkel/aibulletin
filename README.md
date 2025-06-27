# AI Web Content Summarizer

A full-stack web application that crawls websites and generates AI-powered summaries using OpenAI's GPT-4o-mini model.

## Features

- **Web Crawling**: Uses Crawlee with Playwright to handle modern, JavaScript-heavy websites
- **AI Summarization**: Integrates with OpenAI API for intelligent content processing
- **Custom Prompts**: Users can specify their own summarization instructions
- **Clean UI**: Modern React frontend with Tailwind CSS
- **Real-time Processing**: Live status updates during crawling

## Tech Stack

- **Backend**: Python, FastAPI, Crawlee, OpenAI API
- **Frontend**: React, Vite, Tailwind CSS
- **Crawling**: Playwright (via Crawlee)
- **AI**: OpenAI GPT-4o-mini

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

4. Create a `.env` file in the backend directory:
   ```bash
   echo "OPENAI_API_KEY=your_actual_openai_api_key_here" > .env
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

1. Open your browser and go to `http://localhost:5173`
2. Enter URLs (one per line) in the first textarea
3. Customize the summarization prompt in the second textarea
4. Click "Start Crawl & Summarize"
5. Wait for the results to appear

## API Endpoints

- `GET /`: Health check endpoint
- `POST /crawl-and-summarize`: Main endpoint for crawling and summarizing

### Request Format
```json
{
  "urls": ["https://example.com", "https://example2.com"],
  "custom_prompt": "Provide a 5-bullet point summary"
}
```

### Response Format
```json
[
  {
    "url": "https://example.com",
    "summary": "Generated summary text..."
  }
]
```

## Configuration

- **Max Requests Per Crawl**: Set to 15 by default (configurable in `main.py`)
- **Text Length Limit**: 8000 characters to avoid token limits
- **OpenAI Model**: GPT-4o-mini
- **Max Tokens**: 500 for summaries

## Error Handling

The application includes comprehensive error handling for:
- Invalid URLs
- Network errors
- OpenAI API errors
- Crawling failures

## Development

To run both frontend and backend in development mode:

1. Start the backend (from backend directory):
   ```bash
   python main.py
   ```

2. Start the frontend (from frontend directory):
   ```bash
   npm run dev
   ```

## Notes

- Make sure to replace `your_actual_openai_api_key_here` with your real OpenAI API key
- The crawler is configured to run headless by default
- CORS is enabled for localhost:5173 (frontend)
- All dependencies are specified in their respective requirements files 