#!/usr/bin/env python3
"""
Gradio Client for HuggingFace Spaces Integration
Provides a command-line interface to call HF Spaces via gradio_client
"""

import sys
import json
import logging
from gradio_client import Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_cover(title, subtitle="", client_id="generic", style="energy_fields"):
    """Generate cover using HF Spaces via Gradio Client"""
    
    try:
        # Connect to HF Space - try different URL formats
        space_urls = [
            "ValtronK/crypto-news-lora-generator",
            "https://huggingface.co/spaces/ValtronK/crypto-news-lora-generator"
        ]
        
        client = None
        for space_url in space_urls:
            try:
                logger.info(f"🤗 Attempting to connect to HF Space: {space_url}")
                client = Client(space_url)
                logger.info(f"✅ Successfully connected to: {space_url}")
                break
            except Exception as e:
                logger.warning(f"⚠️ Failed to connect to {space_url}: {e}")
                continue
        
        if not client:
            raise Exception("Could not connect to any HF Space URL")
        
        # Call the gradio_generate function with parameters
        logger.info(f"🎨 Generating cover: '{title}' | Client: {client_id} | Style: {style}")
        
        result = client.predict(
            title,      # title_input
            subtitle,   # subtitle_input  
            client_id,  # client_select
            style,      # style_select
            api_name="/predict"
        )
        
        # Result should be [status_text, image_data]
        if result and len(result) >= 2:
            status_text, image_data = result[0], result[1]
            
            if status_text and "✅" in status_text and image_data:
                logger.info("✅ Cover generated successfully")
                
                return {
                    "success": True,
                    "image_url": image_data,
                    "status": status_text,
                    "metadata": {
                        "title": title,
                        "subtitle": subtitle,
                        "client_id": client_id,
                        "style": style,
                        "generation_method": "gradio_client"
                    }
                }
            else:
                logger.error(f"❌ Generation failed: {status_text}")
                return {
                    "success": False,
                    "error": f"Generation failed: {status_text}",
                    "image_url": None
                }
        else:
            logger.error("❌ Invalid response format")
            return {
                "success": False,
                "error": "Invalid response format from HF Spaces",
                "image_url": None
            }
            
    except Exception as e:
        logger.error(f"❌ Gradio client error: {str(e)}")
        return {
            "success": False,
            "error": f"Gradio client error: {str(e)}",
            "image_url": None
        }

def main():
    """Command line interface"""
    if len(sys.argv) < 2:
        print("Usage: python3 gradio_client.py <title> [subtitle] [client_id] [style]")
        sys.exit(1)
    
    title = sys.argv[1]
    subtitle = sys.argv[2] if len(sys.argv) > 2 else ""
    client_id = sys.argv[3] if len(sys.argv) > 3 else "generic"
    style = sys.argv[4] if len(sys.argv) > 4 else "energy_fields"
    
    result = generate_cover(title, subtitle, client_id, style)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()