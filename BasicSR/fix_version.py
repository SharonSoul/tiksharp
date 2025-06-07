import os

def create_version_file():
    version_content = """# GENERATED VERSION FILE
# TIME: {}
__version__ = '1.4.2'
__gitsha__ = 'unknown'
version_info = (1, 4, 2)
"""
    
    # Create the basicsr directory if it doesn't exist
    os.makedirs('basicsr', exist_ok=True)
    
    # Write the version file
    with open('basicsr/version.py', 'w', encoding='utf-8') as f:
        f.write(version_content)

if __name__ == '__main__':
    create_version_file()
    print("Version file created successfully!") 