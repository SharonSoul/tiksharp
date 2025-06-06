import sys
import os
import traceback
import cv2
import numpy as np

def check_dependencies():
    try:
        import cv2
        print(f"OpenCV version: {cv2.__version__}")
        print(f"NumPy version: {np.__version__}")
        return True
    except ImportError as e:
        print(f"Error importing dependencies: {str(e)}")
        print("Please run: pip install opencv-python numpy")
        return False

def upscale_image(input_path, output_path):
    try:
        print(f"Reading image from: {input_path}")
        # Read the image
        img = cv2.imread(input_path)
        if img is None:
            raise Exception(f"Failed to read image: {input_path}")

        # Get original dimensions
        height, width = img.shape[:2]
        print(f"Original image size: {width}x{height}")
        
        # Calculate new dimensions (2x upscale)
        new_width = width * 2
        new_height = height * 2
        print(f"New image size: {new_width}x{new_height}")
        
        # Upscale using INTER_LANCZOS4 (highest quality)
        print("Upscaling image...")
        upscaled = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
        
        # Apply sharpening
        print("Applying sharpening...")
        kernel = np.array([[-1,-1,-1],
                         [-1, 9,-1],
                         [-1,-1,-1]])
        sharpened = cv2.filter2D(upscaled, -1, kernel)
        
        # Save with high quality
        print(f"Saving upscaled image to: {output_path}")
        success = cv2.imwrite(output_path, sharpened, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            raise Exception(f"Failed to save image to: {output_path}")
        
        print("Image upscaling completed successfully")
        return output_path
    except Exception as e:
        print(f"Error during upscaling: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python upscale.py <input_path> <output_path>")
        sys.exit(1)
    
    # Check dependencies first
    if not check_dependencies():
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    print(f"Starting upscaling process...")
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")
    
    try:
        upscale_image(input_path, output_path)
        print(f"Successfully upscaled image to {output_path}")
    except Exception as e:
        print(f"Error upscaling image: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1) 