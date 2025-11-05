#!/usr/bin/env python3
"""
FIXED: LoRA Loading with proper weight_name specification
This fixes the "multiple weights file" error
"""
# ... existing imports and code ...

def load_lora_weights(self, client, style):
    """Load appropriate LoRA weights - FIXED VERSION"""
    if not self.pipeline:
        return False
    
    # Try specific client/style LoRA first
    lora_key = f"{client}_{style}"
    if lora_key in self.lora_available:
        lora_path = self.lora_available[lora_key]
    elif "universal" in self.lora_available:
        lora_path = self.lora_available["universal"]
        lora_key = "universal"
    else:
        logger.info(f"📝 No LoRA available for {client}/{style}")
        return False
    
    try:
        # Unload previous LoRA
        if self.current_lora:
            self.pipeline.unload_lora_weights()
        
        # ✅ FIX: Check if path is directory or file
        if os.path.isdir(lora_path):
            # If it's a directory, extract filename and use weight_name
            lora_dir = lora_path
            lora_file = "crypto_cover_styles_lora.safetensors"
            logger.info(f"🔧 Loading LoRA from directory: {lora_dir} with weight_name: {lora_file}")
            self.pipeline.load_lora_weights(
                lora_dir,
                weight_name=lora_file
            )
        else:
            # If it's a file path, load directly
            logger.info(f"🔧 Loading LoRA from file: {lora_path}")
            self.pipeline.load_lora_weights(lora_path)
        
        self.current_lora = lora_key
        logger.info(f"✅ Loaded LoRA: {lora_key}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to load LoRA {lora_path}: {e}")
        logger.error(f"   Error type: {type(e).__name__}")
        logger.error(f"   Error details: {str(e)}")
        
        # Try alternative loading method
        try:
            logger.info(f"🔄 Trying alternative loading method...")
            lora_dir = "models/lora"
            lora_file = "crypto_cover_styles_lora.safetensors"
            
            # Method: Load from directory with explicit weight_name
            if os.path.exists(os.path.join(lora_dir, lora_file)):
                logger.info(f"🔧 Attempting directory + weight_name method...")
                self.pipeline.load_lora_weights(
                    lora_dir,
                    weight_name=lora_file
                )
                self.current_lora = lora_key
                logger.info(f"✅ LoRA loaded successfully with alternative method!")
                return True
        except Exception as e2:
            logger.error(f"❌ Alternative loading method also failed: {e2}")
        
        return False

