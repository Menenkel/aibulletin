import json
import os
from typing import List, Optional
from pathlib import Path

class Storage:
    def __init__(self, storage_dir: str = "data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        
        self.api_key_file = self.storage_dir / "api_key.json"
        self.urls_file = self.storage_dir / "saved_urls.json"
        self.system_prompt_file = self.storage_dir / "system_prompt.json"
    
    def save_api_key(self, api_key: str) -> bool:
        """Save API key to file."""
        try:
            with open(self.api_key_file, 'w') as f:
                json.dump({"api_key": api_key}, f)
            return True
        except Exception as e:
            print(f"Error saving API key: {e}")
            return False
    
    def load_api_key(self) -> Optional[str]:
        """Load API key from file."""
        try:
            if self.api_key_file.exists():
                with open(self.api_key_file, 'r') as f:
                    data = json.load(f)
                    return data.get("api_key")
        except Exception as e:
            print(f"Error loading API key: {e}")
        return None
    
    def save_system_prompt(self, prompt: str) -> bool:
        """Save system prompt to file."""
        try:
            with open(self.system_prompt_file, 'w') as f:
                json.dump({"system_prompt": prompt}, f)
            return True
        except Exception as e:
            print(f"Error saving system prompt: {e}")
            return False
    
    def load_system_prompt(self) -> str:
        """Load system prompt from file."""
        try:
            if self.system_prompt_file.exists():
                with open(self.system_prompt_file, 'r') as f:
                    data = json.load(f)
                    return data.get("system_prompt", "")
        except Exception as e:
            print(f"Error loading system prompt: {e}")
        return ""
    
    def save_urls(self, urls: List[str], region: str = "Global Overview", custom_prompt: str = "") -> bool:
        """Save URLs with region and custom prompt to file."""
        try:
            # Load existing URLs
            existing_data = self.load_urls()
            
            # Add new URLs with timestamp
            import datetime
            timestamp = datetime.datetime.now().isoformat()
            
            new_entry = {
                "urls": urls,
                "region": region,
                "custom_prompt": custom_prompt,
                "timestamp": timestamp
            }
            
            existing_data.append(new_entry)
            
            # Keep only last 10 entries to avoid file getting too large
            if len(existing_data) > 10:
                existing_data = existing_data[-10:]
            
            with open(self.urls_file, 'w') as f:
                json.dump(existing_data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving URLs: {e}")
            return False
    
    def load_urls(self) -> List[dict]:
        """Load saved URLs from file."""
        try:
            if self.urls_file.exists():
                with open(self.urls_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading URLs: {e}")
        return []
    
    def get_recent_urls(self, limit: int = 5) -> List[dict]:
        """Get recent URL entries."""
        urls = self.load_urls()
        return urls[-limit:] if urls else []
    
    def get_recent_prompt(self) -> str:
        """Get the most recent custom prompt, if any."""
        urls = self.load_urls()
        if urls and 'custom_prompt' in urls[-1]:
            return urls[-1]['custom_prompt']
        return ""
    
    def clear_api_key(self) -> bool:
        """Clear saved API key."""
        try:
            if self.api_key_file.exists():
                os.remove(self.api_key_file)
            return True
        except Exception as e:
            print(f"Error clearing API key: {e}")
            return False 