@echo off
echo Fixing dependencies...

REM Uninstall current versions
pip uninstall -y numpy opencv-python basicsr torch torchvision realesrgan gfpgan

REM Install dependencies
pip install --upgrade pip
pip install numpy
pip install opencv-python

echo Done! 