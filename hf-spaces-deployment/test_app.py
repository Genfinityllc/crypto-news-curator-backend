from fastapi import FastAPI
import uvicorn

# Minimal test app to diagnose HF Spaces issues
app = FastAPI(title="Test App")

@app.get("/")
async def root():
    return {"message": "Test app is working!", "status": "ok"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/test")
async def test():
    return {"test": "POST endpoint working"}

if __name__ == "__main__":
    uvicorn.run("test_app:app", host="0.0.0.0", port=7860)