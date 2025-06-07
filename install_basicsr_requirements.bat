@echo off
echo Installing BasicSR and its dependencies...

:: Install specific versions of dependencies
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cu118
pip install numpy==1.24.3
pip install Pillow==9.5.0
pip install opencv-python==4.7.0.72
pip install scipy==1.10.1
pip install scikit-image==0.20.0
pip install tqdm==4.65.0
pip install pyyaml==6.0
pip install tb-nightly==2.14.0a20230614
pip install lmdb==1.4.1
pip install yapf==0.40.1
pip install isort==5.12.0
pip install flake8==6.0.0

:: Install BasicSR from GitHub
pip install git+https://github.com/XPixelGroup/BasicSR.git

echo Installation complete!
pause 