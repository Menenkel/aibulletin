from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from storage import Storage

# Load environment variables
load_dotenv()

app = FastAPI(title="Drought Bulletin API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage
storage = Storage()

# Global variables
api_key = None
PDF_SUPPORT = True

# Load API key on startup
@app.on_event("startup")
async def startup_event():
    global api_key
    api_key = storage.load_api_key()
    if api_key:
        print("Loaded saved API key from storage")
    else:
        print("No saved API key found")
    print("PDF support enabled")

# Pydantic models
class ApiKeyRequest(BaseModel):
    api_key: str

class CrawlRequest(BaseModel):
    urls: List[str]
    region: str = "Global Overview"
    custom_prompt: str = ""

class SavedUrl(BaseModel):
    urls: List[str]
    region: str
    custom_prompt: str
    timestamp: str

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint that returns system status."""
    return {
        "status": "healthy",
        "pdf_support": PDF_SUPPORT,
        "api_key_configured": api_key is not None
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Drought Bulletin API is running"}

# API key management
@app.post("/api-key")
async def set_api_key(request: ApiKeyRequest):
    """Set the OpenAI API key."""
    global api_key
    api_key = request.api_key
    
    # Test the API key
    try:
        client = OpenAI(api_key=api_key)
        # Make a simple test call
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        
        # Save the API key if test succeeds
        if storage.save_api_key(api_key):
            return {"message": "API key set and saved successfully"}
        else:
            return {"message": "API key set but failed to save"}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid API key: {str(e)}")

@app.get("/api-key/status")
async def get_api_key_status():
    """Check if API key is configured."""
    return {"has_api_key": api_key is not None}

# Simple web scraping function (no browser required)
def scrape_url(url: str) -> str:
    """Scrape text content from a URL using requests and BeautifulSoup."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Check if it's a PDF
        if response.headers.get('content-type', '').lower().startswith('application/pdf'):
            return f"[PDF Content from {url}]"
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text[:5000]  # Limit to 5000 characters
        
    except Exception as e:
        return f"Error scraping {url}: {str(e)}"

# Main crawling and summarization endpoint
@app.post("/crawl-and-summarize")
async def crawl_and_summarize(request: CrawlRequest):
    """Crawl URLs and generate drought analysis summary."""
    global api_key
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key not configured")
    
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    try:
        # Limit to first 3 URLs for simplicity
        urls_to_process = request.urls[:3]
        
        # Scrape content from URLs
        scraped_content = []
        for url in urls_to_process:
            print(f"Scraping: {url}")
            content = scrape_url(url)
            scraped_content.append(f"Content from {url}:\n{content}\n")
        
        # Combine all content
        combined_content = "\n".join(scraped_content)
        
        # Generate analysis using OpenAI
        client = OpenAI(api_key=api_key)
        
        # Create the prompt
        base_prompt = f"""
        Analyze the following content from drought and food security monitoring sources for {request.region}.
        
        Provide a structured drought bulletin with the following sections:
        1. Current Drought Conditions: Assess the severity and extent of drought in the region
        2. Water Resources: Status of surface water, groundwater, and reservoir levels
        3. Impact on Food Security and Agriculture: Effects on crops and livestock
        4. Food Prices and Economic Impact: Analysis of price trends and economic consequences
        
        Focus on recent developments, trends, and actionable insights. Provide specific data and examples where available.
        """
        
        if request.custom_prompt:
            base_prompt += f"\n\nAdditional analysis requirements: {request.custom_prompt}"
        
        # Make the API call
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a drought and food security analyst. Provide clear, structured analysis."},
                {"role": "user", "content": f"{base_prompt}\n\nContent to analyze:\n{combined_content}"}
            ],
            max_tokens=1500,
            temperature=0.3
        )
        
        analysis = response.choices[0].message.content
        
        # Save the URLs for future reference
        storage.save_urls(request.urls, request.region, request.custom_prompt)
        
        return {
            "analysis": analysis,
            "urls_processed": urls_to_process,
            "region": request.region,
            "timestamp": "2025-01-27T12:00:00Z"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Regions endpoint
@app.get("/regions")
async def get_regions():
    """Get available regions."""
    return [
        "Global Overview",
        "Sub-Saharan Africa",
        "North Africa",
        "Middle East",
        "South Asia",
        "Southeast Asia",
        "Latin America",
        "Caribbean",
        "Europe",
        "North America"
    ]

# Saved URLs endpoint
@app.get("/saved-urls")
async def get_saved_urls():
    """Get recently saved URLs."""
    return storage.get_recent_urls()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 