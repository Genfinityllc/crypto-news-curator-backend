# 🖼️ **Card-Optimized Image Generation Guide**

## ✅ **What's New**

Your backend now supports **card-optimized image generation** for articles! This means you can generate images that are perfectly sized for different card layouts in your frontend.

## 📱 **Available Card Sizes**

### **1. Small Cards (300x169)**
- **Use case**: Mobile cards, compact layouts
- **Aspect ratio**: 16:9
- **Perfect for**: Mobile-first designs, list views

### **2. Medium Cards (400x225)**
- **Use case**: Standard cards, desktop layouts
- **Aspect ratio**: 16:9
- **Perfect for**: Main article grids, featured content

### **3. Large Cards (500x281)**
- **Use case**: Featured cards, hero sections
- **Aspect ratio**: 16:9
- **Perfect for**: Hero articles, featured stories

### **4. Square Cards (300x300)**
- **Use case**: Social media, grid layouts
- **Aspect ratio**: 1:1
- **Perfect for**: Instagram-style grids, social sharing

## 🔧 **API Endpoints**

### **Generate Card-Optimized Images**
```bash
POST /api/news/generate-card-cover/:id
```

**Request Body:**
```json
{
  "size": "medium"  // "small", "medium", "large", "square"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coverImage": "https://via.placeholder.com/400x225/f7931a/ffffff?text=Article Title",
    "cardImages": {
      "small": "https://via.placeholder.com/300x169/f7931a/ffffff?text=Article Title",
      "medium": "https://via.placeholder.com/400x225/f7931a/ffffff?text=Article Title",
      "large": "https://via.placeholder.com/500x281/f7931a/ffffff?text=Article Title",
      "square": "https://via.placeholder.com/300x300/f7931a/ffffff?text=Article Title"
    },
    "selectedSize": "medium"
  }
}
```

## 🎨 **Network-Specific Colors**

Each cryptocurrency network gets its own color scheme:

- **Bitcoin**: Orange (`#f7931a`)
- **Ethereum**: Blue (`#627eea`)
- **Solana**: Purple (`#9945ff`)
- **Cardano**: Blue (`#0033ad`)
- **XRP**: Dark Gray (`#23292f`)
- **Polkadot**: Pink (`#e6007a`)
- **Chainlink**: Blue (`#2a5ada`)
- **Polygon**: Purple (`#8247e5`)
- **Avalanche**: Red (`#e84142`)
- **Uniswap**: Pink (`#ff007a`)
- **Hedera HBAR**: Cyan (`#00f2ff`)
- **XDC Network**: Orange (`#ffa500`)
- **Constellation DAG**: Purple (`#9c27b0`)

## 📋 **Frontend Integration**

### **CSS for Card Layouts**

```css
/* Small cards */
.card-small img {
  width: 300px;
  height: 169px;
  object-fit: cover;
  border-radius: 8px;
}

/* Medium cards */
.card-medium img {
  width: 400px;
  height: 225px;
  object-fit: cover;
  border-radius: 12px;
}

/* Large cards */
.card-large img {
  width: 500px;
  height: 281px;
  object-fit: cover;
  border-radius: 16px;
}

/* Square cards */
.card-square img {
  width: 300px;
  height: 300px;
  object-fit: cover;
  border-radius: 12px;
}

/* Responsive design */
@media (max-width: 768px) {
  .card-medium img {
    width: 100%;
    height: 200px;
  }
  
  .card-large img {
    width: 100%;
    height: 250px;
  }
}
```

### **React Component Example**

```javascript
const ArticleCard = ({ article, size = 'medium' }) => {
  const [cardImage, setCardImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateCardImage = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/news/generate-card-cover/${article.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size })
      });
      
      const data = await response.json();
      if (data.success) {
        setCardImage(data.data.coverImage);
      }
    } catch (error) {
      console.error('Error generating card image:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card-${size}`}>
      {cardImage ? (
        <img src={cardImage} alt={article.title} />
      ) : (
        <button onClick={generateCardImage} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Card Image'}
        </button>
      )}
      <h3>{article.title}</h3>
      <p>{article.summary}</p>
    </div>
  );
};
```

## 🧪 **Testing**

### **Test Card Image Generation**
```bash
# Test with a specific article
curl -X POST "http://localhost:3000/api/news/generate-card-cover/[ARTICLE_ID]" \
  -H "Content-Type: application/json" \
  -d '{"size": "medium"}'
```

### **Test Different Sizes**
```bash
# Small cards
curl -X POST "http://localhost:3000/api/news/generate-card-cover/[ARTICLE_ID]" \
  -H "Content-Type: application/json" \
  -d '{"size": "small"}'

# Large cards
curl -X POST "http://localhost:3000/api/news/generate-card-cover/[ARTICLE_ID]" \
  -H "Content-Type: application/json" \
  -d '{"size": "large"}'

# Square cards
curl -X POST "http://localhost:3000/api/news/generate-card-cover/[ARTICLE_ID]" \
  -H "Content-Type: application/json" \
  -d '{"size": "square"}'
```

## 🎯 **Benefits**

1. **Perfect Fit**: Images are sized exactly for your card layouts
2. **Network Branding**: Each cryptocurrency gets its own color scheme
3. **Multiple Sizes**: Choose the right size for different layouts
4. **Responsive**: Works great on mobile and desktop
5. **Fast Loading**: Optimized placeholder images
6. **Consistent**: All images follow the same design pattern

## 🚀 **Next Steps**

1. **Test the API** with different article IDs and sizes
2. **Integrate with your frontend** using the provided CSS and React examples
3. **Customize colors** for additional networks if needed
4. **Add image caching** for better performance
5. **Consider real AI image generation** for production

Your articles will now have perfectly sized images for any card layout! 🎉

