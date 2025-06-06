@echo off
echo Installing Python dependencies...

REM Create and activate virtual environment
python -m venv venv
call venv\Scripts\activate

REM Upgrade pip
python -m pip install --upgrade pip

REM Install basic requirements with specific versions
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cu118
pip install numpy==1.24.3
pip install Pillow==9.5.0
pip install opencv-python==4.7.0.72

REM Install basicsr from source
git clone https://github.com/XPixelGroup/BasicSR.git
cd BasicSR
pip install -e .
cd ..

REM Install additional dependencies
pip install facexlib==0.2.5
pip install gfpgan==1.3.8
pip install realesrgan==0.3.0

REM Install other required packages
pip install tb-nightly==2.14.0a20230614
pip install yapf==0.40.1
pip install isort==5.12.0
pip install flake8==6.0.0
pip install lmdb==1.4.1
pip install pyyaml==6.0
pip install tqdm==4.65.0
pip install requests==2.31.0
pip install scipy==1.10.1
pip install scikit-image==0.20.0
pip install lpips==0.1.4

echo Done! 