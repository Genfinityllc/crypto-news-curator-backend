# Hugging Face Spaces Deployment Instructions

## Step 1: Create HF Spaces Repository

1. Go to [Hugging Face Spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Fill in details:
   - **Space name**: `crypto-news-lora-generator`
   - **License**: `mit`
   - **SDK**: `Docker`
   - **Hardware**: `CPU basic` (free tier)
   - **Visibility**: `Public`

## Step 2: Upload Files

Upload all files from this `hf-spaces-deployment` folder to your new Space:

```
crypto-news-lora-generator/
├── app.py
├── simple_lora_generator.py
├── requirements.txt
├── Dockerfile
├── README.md
└── .gitignore
```

## Step 3: Configure Space

In your Space settings:
- Set the main branch to `main`
- Ensure Docker SDK is selected
- The app will automatically start on port 7860

## Step 4: Test Deployment

Once deployed, test the API:

```bash
curl -X POST "https://YOUR-USERNAME-crypto-news-lora-generator.hf.space/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Revolutionary DeFi Protocol Launches",
    "subtitle": "ALGORAND NEWS",
    "client": "algorand",
    "style": "energy_fields"
  }'
```

## Step 5: Integration with Railway Backend

Your HF Space URL will be:
`https://YOUR-USERNAME-crypto-news-lora-generator.hf.space`

Update your Railway backend to use this URL instead of local generation.

## Alternative: Quick Deploy Button

You can also use git to deploy:

```bash
git clone https://huggingface.co/spaces/YOUR-USERNAME/crypto-news-lora-generator
cd crypto-news-lora-generator
# Copy files from hf-spaces-deployment/
git add .
git commit -m "Initial deployment"
git push
```

## Expected Response Format

```json
{
  "success": true,
  "image_url": "/download/algorand.png",
  "metadata": {
    "client": "algorand",
    "style": "energy_fields",
    "title": "Revolutionary DeFi Protocol Launches"
  }
}
```

## Troubleshooting

- **Build fails**: Check requirements.txt compatibility
- **Generation slow**: CPU-only generation takes 30-60 seconds
- **Memory issues**: Reduce image size or optimize code
- **Timeout**: Increase timeout in app.py (current: 120s)

## Upgrade Options

For faster generation:
- Upgrade to GPU hardware (paid)
- Use HF Inference API
- Optimize model loading