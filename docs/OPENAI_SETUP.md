# OpenAI API Setup Guide

## 🚀 ChatGPT Integration for AI Rewrite

This guide will help you set up the OpenAI API integration for the AI Rewrite functionality.

### 1. Get Your OpenAI API Key

1. **Visit OpenAI Platform**: Go to [https://platform.openai.com/](https://platform.openai.com/)
2. **Sign Up/Login**: Create an account or sign in
3. **Go to API Keys**: Navigate to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
4. **Create New Key**: Click "Create new secret key"
5. **Copy the Key**: Save it securely (you won't see it again)

### 2. Add API Key to Your Environment

Add your OpenAI API key to your `.env` file:

```bash
# Add this line to your .env file
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 3. Model Configuration

The system is configured to use the latest GPT models with automatic fallback:

1. **Primary**: `gpt-4o` (latest GPT-4 model)
2. **Fallback 1**: `gpt-4-turbo` 
3. **Fallback 2**: `gpt-4`
4. **Fallback 3**: `gpt-3.5-turbo`
5. **Final Fallback**: Simulated AI rewrite (if no API key or all models fail)

### 4. Features Included

✅ **Advanced Prompting**: Specialized crypto journalism prompts
✅ **Model Fallback**: Automatic fallback to available models
✅ **Error Handling**: Graceful degradation if API fails
✅ **Readability Optimization**: Targets 97+ Flesch Reading Ease score
✅ **SEO Optimization**: Natural keyword integration
✅ **Viral Content**: Psychological triggers and engaging language
✅ **Google Ads Compliance**: Advertiser-friendly content
✅ **Factual Accuracy**: Preserves all key facts and data

### 5. Usage

Once configured, the AI Rewrite button will:

1. **Analyze** the original article
2. **Rewrite** using advanced GPT models
3. **Optimize** for readability and engagement
4. **Calculate** viral and readability scores
5. **Display** the rewritten content with metrics

### 6. API Costs

- **GPT-4o**: ~$15/1M input tokens, ~$60/1M output tokens
- **GPT-4-turbo**: ~$10/1M input tokens, ~$30/1M output tokens  
- **GPT-4**: ~$30/1M input tokens, ~$60/1M output tokens
- **GPT-3.5-turbo**: ~$0.50/1M input tokens, ~$1.50/1M output tokens

*Typical rewrite costs $0.01-0.05 per article*

### 7. When GPT-5 is Released

Simply update the model in `src/services/aiService.js`:

```javascript
model: 'gpt-5', // Change this line when GPT-5 is available
```

### 8. Testing

1. **Add your API key** to `.env`
2. **Restart the backend** server
3. **Click "Generate AI Rewrite"** on any article
4. **Check logs** for successful API calls

### 9. Troubleshooting

**No API Key**: Falls back to simulated rewrite
**Invalid Key**: Check your OpenAI account and regenerate
**Rate Limits**: Will use fallback models automatically
**Network Issues**: Includes 30-second timeout with retry logic

### 10. Security Notes

- ❌ **Never commit** your API key to git
- ✅ **Use environment variables** only
- ✅ **Keep your key secure** and rotate regularly
- ✅ **Monitor usage** on OpenAI dashboard