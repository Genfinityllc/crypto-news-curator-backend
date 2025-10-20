#!/usr/bin/env python3
"""
Automated Cover Collection System
Gathers original covers from multiple sources for Universal LoRA training
"""
import os
import requests
import json
from pathlib import Path
from PIL import Image
import hashlib
import time
from urllib.parse import urljoin, urlparse
import logging
from typing import List, Dict, Optional
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoverCollector:
    def __init__(self, output_dir="training_data/collected_covers"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create organized structure for Universal LoRA
        self.structure = {
            "hedera": ["energy_fields", "dark_theme", "corporate", "tech"],
            "algorand": ["network_nodes", "teal_style", "corporate", "tech"], 
            "constellation": ["particle_waves", "space_theme", "corporate", "tech"],
            "bitcoin": ["orange_theme", "gold_style", "corporate"],
            "ethereum": ["blue_theme", "tech_style", "corporate"]
        }
        
        # Known sources to collect from
        self.sources = [
            "crypto_news_api",
            "generated_history", 
            "web_scraping",
            "supabase_database"
        ]
        
        self.collected_metadata = []
    
    def collect_from_crypto_news_sites(self):
        """Collect covers from major crypto news sites"""
        logger.info("🌐 Collecting covers from crypto news websites...")
        
        # Major crypto news sites with good cover images
        news_sources = [
            {
                "name": "CoinDesk",
                "base_url": "https://www.coindesk.com",
                "api_endpoint": "/api/articles",
                "image_selector": "article img[src*='cover']"
            },
            {
                "name": "Decrypt",
                "base_url": "https://decrypt.co", 
                "rss_url": "https://decrypt.co/feed"
            },
            {
                "name": "Bitcoin Magazine",
                "base_url": "https://bitcoinmagazine.com",
                "rss_url": "https://bitcoinmagazine.com/feed"
            }
        ]
        
        collected_count = 0
        
        for source in news_sources:
            try:
                logger.info(f"📰 Collecting from {source['name']}...")
                
                if source['name'] == "Decrypt":
                    covers = self._collect_from_decrypt()
                elif source['name'] == "Bitcoin Magazine": 
                    covers = self._collect_from_bitcoin_magazine()
                else:
                    covers = self._collect_from_generic_rss(source)
                
                for cover_data in covers:
                    saved_path = self._save_cover_image(cover_data, source['name'])
                    if saved_path:
                        collected_count += 1
                        
                logger.info(f"✅ Collected {len(covers)} covers from {source['name']}")
                
            except Exception as e:
                logger.error(f"❌ Failed to collect from {source['name']}: {e}")
        
        logger.info(f"🎯 Total covers collected from news sites: {collected_count}")
        return collected_count
    
    def _collect_from_decrypt(self):
        """Collect high-quality covers from Decrypt.co"""
        covers = []
        
        try:
            # Use their API if available, otherwise RSS
            rss_url = "https://decrypt.co/feed"
            response = requests.get(rss_url, timeout=30)
            
            if response.status_code == 200:
                # Parse RSS and extract image URLs
                import xml.etree.ElementTree as ET
                root = ET.fromstring(response.content)
                
                for item in root.findall('.//item')[:20]:  # Limit to recent 20
                    title = item.find('title').text if item.find('title') is not None else "Unknown"
                    link = item.find('link').text if item.find('link') is not None else ""
                    
                    # Look for enclosure or media:content tags
                    enclosure = item.find('enclosure')
                    if enclosure is not None and 'image' in enclosure.get('type', ''):
                        image_url = enclosure.get('url')
                        covers.append({
                            'title': title,
                            'url': image_url,
                            'source_url': link,
                            'style': self._detect_style_from_title(title),
                            'client': self._detect_client_from_title(title)
                        })
        
        except Exception as e:
            logger.error(f"Error collecting from Decrypt: {e}")
        
        return covers
    
    def _collect_from_bitcoin_magazine(self):
        """Collect covers from Bitcoin Magazine"""
        covers = []
        
        try:
            rss_url = "https://bitcoinmagazine.com/feed"
            response = requests.get(rss_url, timeout=30)
            
            if response.status_code == 200:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(response.content)
                
                for item in root.findall('.//item')[:15]:
                    title = item.find('title').text if item.find('title') is not None else "Unknown"
                    
                    # Look for featured images in content
                    content = item.find('content:encoded', {'content': 'http://purl.org/rss/1.0/modules/content/'})
                    if content is not None:
                        # Extract image URLs from content
                        img_urls = re.findall(r'<img[^>]+src="([^"]+)"', content.text)
                        for img_url in img_urls:
                            if any(x in img_url.lower() for x in ['cover', 'featured', 'header']):
                                covers.append({
                                    'title': title,
                                    'url': img_url,
                                    'style': 'bitcoin_theme',
                                    'client': 'bitcoin'
                                })
                                break
        
        except Exception as e:
            logger.error(f"Error collecting from Bitcoin Magazine: {e}")
        
        return covers
    
    def collect_from_supabase_history(self, project_id: str):
        """Collect previously generated covers from Supabase"""
        logger.info("🗄️ Collecting covers from Supabase database...")
        
        try:
            # This would connect to your Supabase instance
            # For now, we'll simulate this
            logger.info("📝 Note: Supabase collection requires project credentials")
            logger.info("💡 Tip: Export your generated covers history as JSON for training")
            
            # Example structure for when you implement this:
            sample_query = '''
            SELECT 
                title,
                subtitle, 
                client,
                style,
                image_url,
                created_at,
                metadata
            FROM generated_covers 
            WHERE image_url IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 500;
            '''
            
            logger.info(f"📋 SQL Query to run on your database:\n{sample_query}")
            return []
            
        except Exception as e:
            logger.error(f"❌ Supabase collection failed: {e}")
            return []
    
    def collect_from_generated_history(self, history_dir: str):
        """Collect from local history of generated images"""
        logger.info(f"📁 Collecting from local history: {history_dir}")
        
        if not os.path.exists(history_dir):
            logger.warning(f"⚠️ History directory not found: {history_dir}")
            return 0
        
        collected_count = 0
        
        for root, dirs, files in os.walk(history_dir):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    file_path = os.path.join(root, file)
                    
                    # Extract metadata from filename/path
                    metadata = self._extract_metadata_from_path(file_path)
                    
                    # Copy to organized structure
                    target_path = self._organize_by_metadata(file_path, metadata)
                    if target_path:
                        collected_count += 1
        
        logger.info(f"✅ Collected {collected_count} images from history")
        return collected_count
    
    def _detect_style_from_title(self, title: str) -> str:
        """Detect style category from article title"""
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['energy', 'power', 'field', 'glow']):
            return 'energy_fields'
        elif any(word in title_lower for word in ['dark', 'black', 'night', 'shadow']):
            return 'dark_theme'
        elif any(word in title_lower for word in ['network', 'node', 'connection', 'link']):
            return 'network_nodes'
        elif any(word in title_lower for word in ['wave', 'particle', 'flow', 'motion']):
            return 'particle_waves'
        elif any(word in title_lower for word in ['corporate', 'business', 'professional']):
            return 'corporate'
        else:
            return 'tech_style'
    
    def _detect_client_from_title(self, title: str) -> str:
        """Detect client/brand from article title"""
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['hedera', 'hbar', 'hashgraph']):
            return 'hedera'
        elif any(word in title_lower for word in ['algorand', 'algo']):
            return 'algorand'
        elif any(word in title_lower for word in ['constellation', 'dag']):
            return 'constellation'
        elif any(word in title_lower for word in ['bitcoin', 'btc']):
            return 'bitcoin'
        elif any(word in title_lower for word in ['ethereum', 'eth']):
            return 'ethereum'
        else:
            return 'generic'
    
    def _save_cover_image(self, cover_data: Dict, source_name: str) -> Optional[str]:
        """Download and save cover image"""
        try:
            response = requests.get(cover_data['url'], timeout=30)
            if response.status_code == 200:
                
                # Generate unique filename
                url_hash = hashlib.md5(cover_data['url'].encode()).hexdigest()[:8]
                filename = f"{source_name}_{url_hash}.png"
                
                # Organize by detected style and client
                client = cover_data.get('client', 'generic')
                style = cover_data.get('style', 'tech_style')
                
                save_dir = self.output_dir / client / style
                save_dir.mkdir(parents=True, exist_ok=True)
                
                save_path = save_dir / filename
                
                # Process image
                image = Image.open(response.content)
                image = image.convert('RGB')
                
                # Resize to consistent training size
                if image.size != (1800, 900):
                    image = image.resize((1800, 900), Image.Resampling.LANCZOS)
                
                image.save(save_path, 'PNG', quality=95)
                
                # Save metadata
                self.collected_metadata.append({
                    'file_path': str(save_path),
                    'original_url': cover_data['url'],
                    'title': cover_data['title'],
                    'client': client,
                    'style': style,
                    'source': source_name
                })
                
                logger.info(f"💾 Saved: {filename} ({client}/{style})")
                return str(save_path)
                
        except Exception as e:
            logger.error(f"❌ Failed to save {cover_data.get('url', 'unknown')}: {e}")
            
        return None
    
    def create_universal_lora_dataset(self):
        """Create dataset optimized for Universal LoRA training"""
        logger.info("🎯 Creating Universal LoRA training dataset...")
        
        dataset_dir = self.output_dir.parent / "universal_lora_dataset"
        dataset_dir.mkdir(exist_ok=True)
        
        # Copy all collected images to flat structure with descriptive captions
        training_images = []
        
        for root, dirs, files in os.walk(self.output_dir):
            for file in files:
                if file.lower().endswith('.png'):
                    source_path = Path(root) / file
                    
                    # Extract client and style from path
                    path_parts = Path(root).parts
                    client = path_parts[-2] if len(path_parts) >= 2 else 'generic'
                    style = path_parts[-1] if len(path_parts) >= 1 else 'tech'
                    
                    # Create universal training filename
                    training_id = len(training_images)
                    target_filename = f"cover_{training_id:04d}.png"
                    target_path = dataset_dir / target_filename
                    
                    # Copy image
                    import shutil
                    shutil.copy2(source_path, target_path)
                    
                    # Create caption for Universal LoRA
                    caption = self._create_universal_caption(client, style, file)
                    caption_path = dataset_dir / f"cover_{training_id:04d}.txt"
                    
                    with open(caption_path, 'w') as f:
                        f.write(caption)
                    
                    training_images.append({
                        'image': str(target_path),
                        'caption': str(caption_path),
                        'client': client,
                        'style': style
                    })
        
        # Save training manifest
        manifest_path = dataset_dir / "training_manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump({
                'dataset_info': {
                    'total_images': len(training_images),
                    'clients': list(set(img['client'] for img in training_images)),
                    'styles': list(set(img['style'] for img in training_images)),
                    'created_for': 'Universal LoRA Training'
                },
                'images': training_images
            }, f, indent=2)
        
        logger.info(f"✅ Universal LoRA dataset created: {len(training_images)} training pairs")
        logger.info(f"📁 Dataset location: {dataset_dir}")
        logger.info(f"📋 Manifest: {manifest_path}")
        
        return dataset_dir, len(training_images)
    
    def _create_universal_caption(self, client: str, style: str, filename: str) -> str:
        """Create comprehensive caption for Universal LoRA training"""
        
        # Base prompt that applies to all
        base = "crypto news cover background, professional design, high quality, 1800x900 resolution"
        
        # Client-specific elements
        client_styles = {
            'hedera': 'purple and magenta color scheme, hedera branding, hashgraph technology',
            'algorand': 'teal and cyan color scheme, algorand branding, blockchain technology',
            'constellation': 'blue and white color scheme, constellation branding, DAG technology',
            'bitcoin': 'orange and gold color scheme, bitcoin branding, cryptocurrency',
            'ethereum': 'blue and purple color scheme, ethereum branding, smart contracts'
        }
        
        # Style-specific elements
        style_descriptions = {
            'energy_fields': 'glowing energy fields, particle effects, cosmic energy, vibrant auras, dynamic lighting',
            'dark_theme': 'dark professional background, subtle geometric patterns, minimal lighting, corporate style',
            'network_nodes': 'connected network nodes, digital connections, tech visualization, futuristic design',
            'particle_waves': 'flowing particle waves, dynamic motion, wave patterns, energy flow',
            'corporate': 'clean corporate design, professional gradients, business style, minimal aesthetic',
            'tech_style': 'technological elements, digital design, modern interface, tech aesthetic'
        }
        
        client_desc = client_styles.get(client, f'{client} color scheme, {client} branding')
        style_desc = style_descriptions.get(style, 'unique visual style, modern design')
        
        # Combine for comprehensive caption
        caption = f"{base}, {style_desc}, {client_desc}"
        
        return caption
    
    def run_full_collection(self):
        """Run complete collection process"""
        logger.info("🚀 Starting full cover collection for Universal LoRA...")
        
        total_collected = 0
        
        # 1. Collect from crypto news sites
        news_count = self.collect_from_crypto_news_sites()
        total_collected += news_count
        
        # 2. Collect from local history if available
        history_dirs = [
            "/Users/valorkopeny/crypto-news-frontend/generated_covers",
            "/Users/valorkopeny/Desktop/cover_history", 
            "./generated_history"
        ]
        
        for history_dir in history_dirs:
            if os.path.exists(history_dir):
                history_count = self.collect_from_generated_history(history_dir)
                total_collected += history_count
        
        # 3. Create Universal LoRA dataset
        if total_collected > 0:
            dataset_dir, training_pairs = self.create_universal_lora_dataset()
            
            logger.info(f"🎯 COLLECTION COMPLETE!")
            logger.info(f"📊 Total covers collected: {total_collected}")
            logger.info(f"📚 Training pairs created: {training_pairs}")
            logger.info(f"📁 Dataset ready at: {dataset_dir}")
            
            # Save collection report
            report = {
                'collection_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'total_collected': total_collected,
                'training_pairs': training_pairs,
                'dataset_location': str(dataset_dir),
                'sources_used': self.sources,
                'ready_for_training': True
            }
            
            with open(self.output_dir / 'collection_report.json', 'w') as f:
                json.dump(report, f, indent=2)
            
            return dataset_dir, training_pairs
        else:
            logger.warning("⚠️ No covers collected - cannot create training dataset")
            return None, 0

if __name__ == "__main__":
    collector = CoverCollector()
    
    print("🎯 Universal LoRA Cover Collection")
    print("==================================")
    print()
    print("This will collect crypto news covers from multiple sources")
    print("and organize them for Universal LoRA training.")
    print()
    
    # Run collection
    dataset_dir, count = collector.run_full_collection()
    
    if dataset_dir and count > 0:
        print(f"✅ SUCCESS! Ready for Universal LoRA training")
        print(f"📚 Dataset: {count} training image pairs")
        print(f"📁 Location: {dataset_dir}")
        print()
        print("🚀 Next steps:")
        print("1. Review collected images in the dataset folder")
        print("2. Run Universal LoRA training with this dataset") 
        print("3. Deploy trained model to your cover generator")
    else:
        print("❌ Collection failed - check logs for issues")