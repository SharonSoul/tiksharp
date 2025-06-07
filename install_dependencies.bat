@echo off
echo Installing Python dependencies...

:: Upgrade pip
python -m pip install --upgrade pip

:: Install setuptools and wheel first
pip install setuptools wheel

:: Install torch and torchvision first
pip install torch torchvision

:: Install other dependencies
pip install -r requirements.txt

:: Install basicsr from a specific commit that is known to work
pip install git+https://github.com/XPixelGroup/BasicSR.git@v1.4.2

echo Installation complete!
pause 