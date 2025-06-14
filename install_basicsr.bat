@echo off
echo Installing BasicSR...

:: Create a temporary directory
mkdir temp_basicsr
cd temp_basicsr

:: Clone the repository
git clone https://github.com/XPixelGroup/BasicSR.git .

:: Checkout specific version
git checkout v1.4.2

:: Install the package
pip install -e .

:: Clean up
cd ..
rmdir /s /q temp_basicsr

echo BasicSR installation complete!
pause 