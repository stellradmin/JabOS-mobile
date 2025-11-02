#!/usr/bin/env python3
"""
Console Log Cleanup Script for Stellr Dating App
Systematically replaces console.* statements with structured logging
Addresses WEEK 2 console.log cleanup requirements
"""

import os
import re
import sys
from pathlib import Path

class ConsoleCleanupTool:
    def __init__(self):
        self.files_processed = 0
        self.statements_replaced = 0
        self.logger_imports_added = 0
        
    def get_relative_logger_path(self, file_path):
        """Calculate the correct relative path to the logger based on file location"""
        file_path = Path(file_path)
        
        if 'app' in file_path.parts:
            return "../src/utils/logger"
        elif 'components' in file_path.parts and 'src' not in file_path.parts:
            return "../src/utils/logger"
        elif 'src' in file_path.parts:
            # Calculate relative path from current location to src/utils/logger
            src_index = file_path.parts.index('src')
            depth = len(file_path.parts) - src_index - 1  # -1 for the file itself
            relative_path = "../" * depth + "utils/logger"
            return relative_path
        else:
            return "./src/utils/logger"
    
    def add_logger_import(self, content, file_path):
        """Add logger import to the file if not already present"""
        if 'from' in content and 'utils/logger' in content:
            return content, False  # Already has logger import
            
        # Find the last import statement
        lines = content.split('\n')
        last_import_index = -1
        
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_index = i
                
        if last_import_index == -1:
            # No imports found, add at the beginning
            logger_path = self.get_relative_logger_path(file_path)
            import_line = f'import {{ logError, logWarn, logInfo, logDebug, logUserAction }} from "{logger_path}";'
            lines.insert(0, import_line)
            self.logger_imports_added += 1
        else:
            # Add after the last import
            logger_path = self.get_relative_logger_path(file_path)
            import_line = f'import {{ logError, logWarn, logInfo, logDebug, logUserAction }} from "{logger_path}";'
            lines.insert(last_import_index + 1, import_line)
            self.logger_imports_added += 1
            
        return '\n'.join(lines), True
    
    def replace_console_statements(self, content):
        """Replace console statements with appropriate logger calls"""
        replacements = 0
        
        # Patterns for different console methods
        patterns = [
            # console.error patterns
            (r'console\.error\(\s*([^,)]+),\s*([^)]+)\)', r'logError(\1, "Error", \2)'),
            (r'console\.error\(\s*([^)]+)\)', r'logError(\1, "Error")'),
            
            # console.warn patterns
            (r'console\.warn\(\s*([^,)]+),\s*([^)]+)\)', r'logWarn(\1, "Warning", \2)'),
            (r'console\.warn\(\s*([^)]+)\)', r'logWarn(\1, "Warning")'),
            
            # console.info patterns
            (r'console\.info\(\s*([^,)]+),\s*([^)]+)\)', r'logInfo(\1, "Info", \2)'),
            (r'console\.info\(\s*([^)]+)\)', r'logInfo(\1, "Info")'),
            
            # console.debug patterns
            (r'console\.debug\(\s*([^,)]+),\s*([^)]+)\)', r'logDebug(\1, "Debug", \2)'),
            (r'console\.debug\(\s*([^)]+)\)', r'logDebug(\1, "Debug")'),
            
            # console.log patterns (most common)
            (r'console\.log\(\s*([^,)]+),\s*([^)]+)\)', r'logDebug(\1, "Debug", \2)'),
            (r'console\.log\(\s*([^)]+)\)', r'logDebug(\1, "Debug")'),
        ]
        
        for pattern, replacement in patterns:
            new_content, count = re.subn(pattern, replacement, content, flags=re.MULTILINE)
            content = new_content
            replacements += count
            
        return content, replacements
    
    def should_process_file(self, file_path):
        """Check if file should be processed"""
        # Exclude certain directories
        exclude_dirs = ['node_modules', '.expo', 'dist', 'build', '.next', '__pycache__']
        for exclude_dir in exclude_dirs:
            if exclude_dir in str(file_path):
                return False
                
        # Only process TypeScript/TSX files
        if not file_path.suffix in ['.ts', '.tsx']:
            return False
            
        return True
    
    def process_file(self, file_path):
        """Process a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if file has console statements
            if 'console.' not in content:
                return False
                
            original_content = content
            
            # Add logger import
            content, import_added = self.add_logger_import(content, file_path)
            
            # Replace console statements
            content, replacements = self.replace_console_statements(content)
            
            # Only write if changes were made
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                self.files_processed += 1
                self.statements_replaced += replacements
                print(f"✅ Processed: {file_path} ({replacements} replacements)")
                return True
            else:
                return False
                
        except Exception as e:
            print(f"❌ Error processing {file_path}: {e}")
            return False
    
    def find_files_with_console(self, root_dir='.'):
        """Find all files containing console statements"""
        files_with_console = []
        
        for root, dirs, files in os.walk(root_dir):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.expo', 'dist', 'build', '.next']]
            
            for file in files:
                if file.endswith(('.ts', '.tsx')):
                    file_path = Path(root) / file
                    if self.should_process_file(file_path):
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                if 'console.' in f.read():
                                    files_with_console.append(file_path)
                        except Exception:
                            continue
                            
        return files_with_console
    
    def run_cleanup(self):
        """Run the complete cleanup process"""
        print("🚀 Starting Console Log Cleanup for Stellr Dating App")
        print("=" * 60)
        
        # Find files with console statements
        print("📍 Finding files with console statements...")
        files_to_process = self.find_files_with_console()
        
        if not files_to_process:
            print("✅ No files found with console statements!")
            return
            
        print(f"📋 Found {len(files_to_process)} files with console statements")
        print()
        
        # Process each file
        for file_path in files_to_process:
            self.process_file(file_path)
            
        print()
        print("=" * 60)
        print("📊 CLEANUP SUMMARY")
        print(f"Files processed: {self.files_processed}")
        print(f"Console statements replaced: {self.statements_replaced}")
        print(f"Logger imports added: {self.logger_imports_added}")
        
        # Verify cleanup
        remaining_files = self.find_files_with_console()
        print(f"Remaining files with console statements: {len(remaining_files)}")
        
        if remaining_files:
            print("\n⚠️  Files still containing console statements:")
            for file_path in remaining_files[:10]:  # Show first 10
                print(f"   - {file_path}")
            if len(remaining_files) > 10:
                print(f"   ... and {len(remaining_files) - 10} more")
        else:
            print("🎉 All console statements successfully replaced!")
            
        print("\n📝 Next Steps:")
        print("1. Review changes to ensure they make contextual sense")
        print("2. Test the application to verify logging works correctly") 
        print("3. Run TypeScript compiler to catch any import issues")
        print("4. Consider removing this cleanup script after verification")

if __name__ == "__main__":
    cleanup_tool = ConsoleCleanupTool()
    cleanup_tool.run_cleanup()