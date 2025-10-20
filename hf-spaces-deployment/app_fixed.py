import os
import sys
import subprocess
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="LoRA Crypto News Image Generator",
    description="Generate LoRA-based crypto news images with client branding",
    version="1.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "algorand"
    style: Optional[str] = "energy_fields"

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "LoRA Crypto News Image Generator",
        "status": "running",
        "endpoints": ["/generate", "/health"]
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "lora-generator"}

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate LoRA-based crypto news cover image"""
    try:
        logger.info(f"🎨 Generating image for: {request.title}")
        
        # Run the simplified generator
        cmd = [
            "python3", 
            "simple_lora_generator.py",
            "--title", request.title,
            "--subtitle", request.subtitle,
            "--client", request.client,
            "--style", request.style or "energy_fields"
        ]
        
        logger.info(f"🚀 Executing: {' '.join(cmd)}")
        
        # Run the generation script
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 2 minute timeout
            cwd="/app"
        )
        
        if result.returncode != 0:
            logger.error(f"❌ Generation failed: {result.stderr}")
            return GenerationResponse(
                success=False,
                error=f"Generation failed: {result.stderr}"
            )
        
        # Check for output file
        output_path = f"/app/style_outputs/boxed_cover_{request.client}.png"
        if os.path.exists(output_path):
            logger.info(f"✅ Image generated: {output_path}")
            
            return GenerationResponse(
                success=True,
                image_url=f"/download/{request.client}.png",
                metadata={
                    "client": request.client,
                    "style": request.style,
                    "title": request.title,
                    "output_path": output_path
                }
            )
        else:
            return GenerationResponse(
                success=False,
                error="Output file not created"
            )
                
    except subprocess.TimeoutExpired:
        logger.error("❌ Generation timeout")
        return GenerationResponse(
            success=False,
            error="Generation timeout"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        return GenerationResponse(
            success=False,
            error=str(e)
        )

@app.get("/download/{client}.png")
async def download_image(client: str):
    """Download generated image"""
    image_path = f"/app/style_outputs/boxed_cover_{client}.png"
    if os.path.exists(image_path):
        return FileResponse(
            image_path, 
            media_type="image/png",
            filename=f"crypto_cover_{client}.png"
        )
    else:
        raise HTTPException(status_code=404, detail="Image not found")

# For HF Spaces compatibility
if __name__ == "__main__":
    import uvicorn
    # HF Spaces expects the app to run on port 7860
    uvicorn.run("app_fixed:app", host="0.0.0.0", port=7860, reload=False)