@echo off
echo Installing BasicSR...

:: Create a temporary directory
mkdir temp_basicsr
cd temp_basicsr

:: Clone the repository
git clone https://github.com/XPixelGroup/BasicSR.git .

:: Install the package directly
pip install .

:: Clean up
cd ..
rmdir /s /q temp_basicsr

echo BasicSR installation complete!
pause 