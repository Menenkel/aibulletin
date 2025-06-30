from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import os
import json
import requests
import tempfile
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from openai import OpenAI
from urllib.parse import urljoin, urlparse
from world_bank_regions import create_regional_prompt, get_all_regions, get_region_for_country
from storage import Storage
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# PDF handling imports
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("Warning: PyPDF2 not installed. PDF support will be disabled.")

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174",
        "http://localhost:3000",
        "https://localhost:5173",
        "https://localhost:5174",
        # Netlify production and preview domains
        "https://aibulletin-test-deployment.windsurf.build",
        # Add your production Netlify domain here if you have one, e.g.:
        # "https://your-app.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage
storage = Storage()

# Global variable to store API key (in memory for current session)
api_key = None
client = None

# Global set to track visited URLs during crawling
visited_urls = set()

# Default system prompt
DEFAULT_SYSTEM_PROMPT = (
    "You're a drought analyst. Analyze the provided URLs and create a comprehensive drought-focused summary for the selected region. Generate the headlines before summarizing the content. Include up to two paragraphs for the following topics and headlines:\n\n"
    "1. Current Drought Conditions: Assess the severity and extent of drought in the region\n"
    "2. Water Resources: Status of surface water, groundwater, and reservoir levels\n"
    "3. Impact on food security and Agriculture: Effects on crops and livestock\n"
    "4. Food prices and economic impact\n\n"
    "Strictly use all headlines based on these four categories and separate the sections with breaks.\n"
    "Ensure that the text describes current conditions without phrases such as 'the report highlights'. Simply summarize conditions from the URLs or PDFs provided. Use no external information."
)

class CrawlRequest(BaseModel):
    urls: List[str]
    custom_prompt: str
    region: str = "Global Overview"
    follow_links: bool = True
    max_depth: int = 2

class ApiKeyRequest(BaseModel):
    api_key: str

class ApiKeyResponse(BaseModel):
    status: str
    message: str

class SystemPromptRequest(BaseModel):
    system_prompt: str

def is_pdf_url(url: str) -> bool:
    """Check if a URL points to a PDF file."""
    parsed = urlparse(url)
    return parsed.path.lower().endswith('.pdf') or 'pdf' in parsed.path.lower()

def extract_text_from_pdf(url: str) -> str:
    """Download and extract text from a PDF file with robust retry logic."""
    if not PDF_SUPPORT:
        return f"Error: PDF support not available. Please install PyPDF2: pip install PyPDF2"
    
    try:
        # Robust download with retries
        session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        session.mount('https://', HTTPAdapter(max_retries=retries))
        session.mount('http://', HTTPAdapter(max_retries=retries))
        print(f"Downloading PDF: {url}")
        response = session.get(url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Check if it's actually a PDF
        content_type = response.headers.get('content-type', '').lower()
        if 'pdf' not in content_type and not url.lower().endswith('.pdf'):
            return f"Error: URL does not appear to be a PDF file (Content-Type: {content_type})"
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            for chunk in response.iter_content(chunk_size=8192):
                temp_file.write(chunk)
            temp_file_path = temp_file.name
        
        # Extract text from PDF
        text_content = []
        try:
            with open(temp_file_path, 'rb') as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text_content.append(f"Page {page_num + 1}:\n{page_text}")
                    except Exception as e:
                        print(f"Error extracting text from page {page_num + 1}: {e}")
                        continue
                os.unlink(temp_file_path)
                if text_content:
                    return "\n\n".join(text_content)
                else:
                    return "No text content could be extracted from the PDF."
        except Exception as e:
            try:
                os.unlink(temp_file_path)
            except:
                pass
            return f"Error reading PDF: {str(e)}"
    except requests.exceptions.RequestException as e:
        print(f"Error downloading PDF: {str(e)}")
        return f"Error downloading PDF: {str(e)}"
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        return f"Error processing PDF: {str(e)}"

async def crawl_url(url: str, browser, depth: int = 1, max_depth: int = 2):
    """Recursively crawl a URL and its sublinks, with PDF support."""
    global visited_urls
    
    if url in visited_urls or depth > max_depth:
        return ""
    
    visited_urls.add(url)
    print(f'Crawling: {url} (depth: {depth})')
    
    # Check if it's a PDF URL
    if is_pdf_url(url):
        print(f"Detected PDF URL: {url}")
        pdf_text = extract_text_from_pdf(url)
        return f"PDF Content from {url}:\n{pdf_text}"
    
    # Regular web page crawling
    page = await browser.new_page()
    try:
        await page.goto(url, timeout=30000, wait_until='networkidle')
        
        # Extract clean main content
        main_text = await page.evaluate("""() => {
            // Remove unwanted elements
            document.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').forEach(el => el.remove());
            
            // Get main content
            const main = document.querySelector('main, article, .content, .post, .entry, .main-content');
            if (main) {
                return main.innerText;
            }
            
            // Fallback to body
            return document.body.innerText;
        }""")
        
        # If content is too short, try fallback
        if not main_text or len(main_text.strip()) < 100:
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            main_text = soup.get_text()
        
        # Extract and filter links for recursive crawling
        if depth < max_depth:
            hrefs = await page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
            base_domain = urlparse(url).netloc
            
            # Filter links to same domain and valid URLs
            sublinks = []
            for href in hrefs:
                try:
                    parsed = urlparse(href)
                    if parsed.netloc == base_domain and href not in visited_urls:
                        sublinks.append(href)
                except:
                    continue
            
            # Limit number of sublinks to crawl to avoid infinite loops
            sublinks = sublinks[:5]  # Limit to 5 sublinks per page
            
            # Recursively crawl sublinks
            sub_content = []
            for link in sublinks:
                sub_text = await crawl_url(link, browser, depth + 1, max_depth)
                if sub_text:
                    sub_content.append(f"Subpage: {link}\n{sub_text[:1000]}")
            
            if sub_content:
                main_text += "\n\n" + "\n\n".join(sub_content)
        
        return main_text
        
    except Exception as e:
        print(f"Error crawling {url}: {e}")
        return f"Error processing {url}: {str(e)}"
    finally:
        await page.close()

@app.on_event("startup")
async def startup_event():
    """Load saved API key on startup."""
    global api_key, client
    
    # Prioritize environment variable for API key, fallback to storage
    loaded_key = os.getenv("OPENAI_API_KEY") or storage.load_api_key()
    if loaded_key:
        api_key = loaded_key
        client = OpenAI(api_key=api_key)
        if os.getenv("OPENAI_API_KEY"):
            print("Loaded API key from environment variable")
        else:
            print("Loaded API key from storage")
    
    # Print PDF support status
    if PDF_SUPPORT:
        print("PDF support enabled")
    else:
        print("PDF support disabled - install PyPDF2 for PDF handling")

@app.post("/api-key", response_model=ApiKeyResponse)
async def set_api_key(request: ApiKeyRequest):
    global api_key, client
    
    # Special handling for 'story' API key for local development
    if request.api_key == "story":
        api_key = "story"
        client = OpenAI(api_key=api_key)  # Will not be used for real calls
        storage.save_api_key(api_key)
        print("Using special 'story' API key for development.")
        return ApiKeyResponse(status="success", message="API key set successfully (development mode)")

    try:
        # Test the API key for any other value
        test_client = OpenAI(api_key=request.api_key)
        test_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5,
        )
        
        api_key = request.api_key
        client = OpenAI(api_key=api_key)
        storage.save_api_key(api_key)
        
        return ApiKeyResponse(status="success", message="API key set successfully")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid API key: {str(e)}")

@app.get("/api-key/status")
async def get_api_key_status():
    return {"has_api_key": bool(api_key)}

@app.get("/regions")
async def get_regions():
    return get_all_regions()

@app.get("/saved-prompt")
async def get_saved_prompt():
    """Get the most recently saved custom prompt."""
    prompt = storage.get_recent_prompt()
    return {"custom_prompt": prompt}

@app.get("/saved-urls")
async def get_saved_urls():
    """Get recently saved URLs."""
    recent_entries = storage.get_recent_urls(1)  # Get only the most recent entry
    if recent_entries:
        return {"urls": recent_entries[0].get("urls", []), "custom_prompt": recent_entries[0].get("custom_prompt", "")}
    return {"urls": [], "custom_prompt": ""}

@app.get("/system-prompt")
async def get_system_prompt():
    """Get the current system prompt, or the default if not set."""
    prompt = storage.load_system_prompt()
    if not prompt:
        prompt = DEFAULT_SYSTEM_PROMPT
    return {"system_prompt": prompt}

@app.post("/system-prompt")
async def set_system_prompt(request: SystemPromptRequest):
    """Set the system prompt."""
    if storage.save_system_prompt(request.system_prompt):
        return {"message": "System prompt saved successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to save system prompt")

@app.post("/crawl-and-summarize")
async def crawl_and_summarize(request: CrawlRequest):
    global api_key, client, visited_urls
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key not set")

    # Development mode with 'story' key
    if api_key == "story":
        print("Running in development mode with 'story' API key. Returning mock data.")
        await asyncio.sleep(3)  # Simulate processing time
        return {
            "analysis": (
                "This is a mock analysis for development purposes because the 'story' API key was used. "
                "This mode allows testing the application flow without making real calls to the OpenAI API.\n\n"
                "1. Current Drought Conditions: Mock assessment of severe drought.\n"
                "2. Water Resources: Mock status of low water levels.\n"
                "3. Impact on Agriculture: Mock effects on crops.\n"
                "4. Economic Impact: Mock summary of economic consequences."
            ),
            "urls_analyzed": len(request.urls),
            "followed_links": request.follow_links,
        }
    
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    # Save URLs, region, and custom prompt to persistent storage
    storage.save_urls(request.urls, request.region, request.custom_prompt)
    
    # Reset visited URLs for this crawling session
    visited_urls.clear()
    
    all_content = []
    total_urls_crawled = 0
    
    # Process URLs - handle PDFs separately from web pages
    for url in request.urls:
        try:
            if is_pdf_url(url):
                # Handle PDF directly
                print(f"Processing PDF: {url}")
                pdf_text = extract_text_from_pdf(url)
                all_content.append(f"Source: {url} (PDF)\n{pdf_text[:4000]}\n\n")
                total_urls_crawled += 1
            else:
                # Handle web pages with Playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    
                    try:
                        if request.follow_links:
                            # Use recursive crawling
                            content = await crawl_url(url, browser, depth=1, max_depth=request.max_depth)
                            total_urls_crawled += len(visited_urls)
                        else:
                            # Use simple single-page crawling
                            page = await browser.new_page()
                            await page.goto(url, wait_until="networkidle", timeout=30000)
                            
                            content = await page.evaluate("""
                                () => {
                                    const scripts = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement');
                                    scripts.forEach(el => el.remove());
                                    
                                    const main = document.querySelector('main, article, .content, .post, .entry');
                                    if (main) {
                                        return main.innerText;
                                    }
                                    
                                    return document.body.innerText;
                                }
                            """)
                            
                            if not content or len(content.strip()) < 100:
                                content = await page.content()
                                soup = BeautifulSoup(content, 'html.parser')
                                content = soup.get_text()
                            
                            await page.close()
                            total_urls_crawled += 1
                        
                        # Add URL source to content for context
                        all_content.append(f"Source: {url}\n{content[:4000]}\n\n")
                        
                    finally:
                        await browser.close()
                        
        except Exception as e:
            all_content.append(f"Source: {url}\nError processing URL: {str(e)}\n\n")
            total_urls_crawled += 1
    
    # Combine all content and create a comprehensive analysis
    combined_content = "\n".join(all_content)
    
    # Create regional prompt for comprehensive analysis
    regional_prompt = create_regional_prompt(request.region, request.custom_prompt)
    
    try:
        # Get comprehensive summary from OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": regional_prompt + "\n\nCRITICAL: Your response MUST start with 'Current Drought Conditions:' and include all four sections in this exact order: Current Drought Conditions, Food Security and Production, Water Resources, Food Prices. Each section must start with the exact header followed by a colon."},
                {"role": "user", "content": f"Please analyze all the following content sources and provide a comprehensive regional analysis:\n\n{combined_content[:12000]}"}
            ],
            max_tokens=1500,
            temperature=0.3
        )
        
        summary = response.choices[0].message.content
        
        return {
            "analysis": summary,
            "urls_analyzed": total_urls_crawled,
            "followed_links": request.follow_links,
            "pdf_support": PDF_SUPPORT
        }
        
    except Exception as e:
        return {"analysis": f"Error generating analysis: {str(e)}"}

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
    return {"message": "Experimental AI Drought Bulletins API", "pdf_support": PDF_SUPPORT}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port) 