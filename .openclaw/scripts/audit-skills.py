#!/usr/bin/env python3
"""
ClawHub Malicious Skills Scanner
Audits SKILL.md files for suspicious patterns and obfuscated payloads.

Based on research from Penligent:
https://www.penligent.ai/hackinglabs/clawhub-malicious-skills-beyond-prompt-injection/

Usage:
    python audit-skills.py [directory]
    
Example:
    python audit-skills.py .openclaw/skills/
"""

import os
import re
import sys
import hashlib
from typing import List, Tuple

# Heuristic patterns for malicious loaders in Markdown
# Format: (pattern, weight, description)
SUSPICIOUS_PATTERNS = [
    (r'base64\s+-d', 10, 'Base64 decoder (common obfuscation)'),
    (r'\|\s*bash', 10, 'Pipe to bash shell'),
    (r'\|\s*sh', 10, 'Pipe to sh shell'),
    (r'\|\s*python', 8, 'Pipe to python interpreter'),
    (r'curl\s+.*\|\s*', 9, 'Fetch and execute pattern'),
    (r'wget\s+.*-\s*O\s*-', 9, 'Fetch to stdout pattern'),
    (r'eval\(', 7, 'Dangerous eval() call'),
    (r'exec\(', 7, 'Dangerous exec() call'),
    (r'http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+', 15, 'Bare IP address (HIGH RISK)'),
    (r'https://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+', 15, 'Bare IP address over HTTPS (HIGH RISK)'),
    (r'/tmp/\.[a-zA-Z0-9_-]+', 8, 'Hidden file in /tmp'),
    (r'chmod\s+\+x', 6, 'Making file executable'),
    (r'\.bashrc|\.zshrc|\.profile', 7, 'Shell config modification'),
    (r'authorized_keys', 9, 'SSH key modification'),
    (r'crontab', 7, 'Cron job modification'),
    (r'systemctl|service\s+', 6, 'System service manipulation'),
]

# High-risk file paths that should never be accessed by skills
SENSITIVE_PATHS = [
    r'~/.ssh/',
    r'~/.aws/',
    r'~/.config/',
    r'~/.gitconfig',
    r'~/.git-credentials',
    r'/etc/passwd',
    r'/etc/shadow',
]

def calculate_file_hash(filepath: str) -> str:
    """Calculate SHA256 hash of file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        return f"ERROR: {str(e)}"

def check_high_entropy(text: str) -> List[str]:
    """Check for high entropy strings (potential obfuscated payloads)."""
    findings = []
    words = text.split()
    for word in words:
        # Skip URLs
        if word.startswith('http://') or word.startswith('https://'):
            continue
        # Check for long, high-entropy strings
        if len(word) > 100:
            findings.append(f"High entropy/long string detected: {word[:50]}...")
    return findings

def scan_skill_file(filepath: str) -> Tuple[int, List[str]]:
    """
    Scan a SKILL.md file for malicious patterns.
    
    Returns:
        (score, findings) where score is risk level and findings are detected issues
    """
    score = 0
    findings = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract code blocks (common location for malicious commands)
        code_blocks = re.findall(r'```(.*?)```', content, re.DOTALL)
        
        # Scan code blocks for suspicious patterns
        for block in code_blocks:
            for pattern, weight, description in SUSPICIOUS_PATTERNS:
                matches = re.findall(pattern, block, re.IGNORECASE)
                if matches:
                    score += weight
                    findings.append(f"[{weight}] {description}: {matches[0][:100]}")
        
        # Check for sensitive path access
        for sensitive_path in SENSITIVE_PATHS:
            if re.search(sensitive_path, content):
                score += 8
                findings.append(f"[8] Accesses sensitive path: {sensitive_path}")
        
        # Check for high entropy strings
        entropy_findings = check_high_entropy(content)
        if entropy_findings:
            score += 5 * len(entropy_findings)
            findings.extend([f"[5] {f}" for f in entropy_findings])
        
        # Check for Base64-encoded strings (potential payloads)
        base64_pattern = r'[A-Za-z0-9+/]{50,}={0,2}'
        base64_matches = re.findall(base64_pattern, content)
        if base64_matches:
            score += 6 * len(base64_matches)
            findings.append(f"[6] Found {len(base64_matches)} potential Base64-encoded strings")
        
    except Exception as e:
        return 0, [f"ERROR reading file: {str(e)}"]
    
    return score, findings

def audit_directory(root_dir: str):
    """Audit all SKILL.md files in a directory tree."""
    print(f"🔍 Scanning {root_dir} for ToxicSkills signatures...\n")
    print("=" * 80)
    
    total_files = 0
    suspicious_files = 0
    critical_files = 0
    
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.lower() in ['skill.md', 'readme.md']:
                total_files += 1
                path = os.path.join(root, file)
                score, findings = scan_skill_file(path)
                
                # Calculate file hash for tracking
                file_hash = calculate_file_hash(path)
                
                if score >= 20:
                    critical_files += 1
                    print(f"🚨 [CRITICAL] {path}")
                    print(f"   Risk Score: {score}")
                    print(f"   SHA256: {file_hash}")
                    for finding in findings:
                        print(f"   ⚠️  {finding}")
                    print()
                elif score >= 10:
                    suspicious_files += 1
                    print(f"⚠️  [SUSPICIOUS] {path}")
                    print(f"   Risk Score: {score}")
                    print(f"   SHA256: {file_hash}")
                    for finding in findings:
                        print(f"   • {finding}")
                    print()
                else:
                    print(f"✅ [SAFE] {path} (Score: {score})")
    
    print("=" * 80)
    print(f"\n📊 Scan Summary:")
    print(f"   Total files scanned: {total_files}")
    print(f"   Critical files: {critical_files}")
    print(f"   Suspicious files: {suspicious_files}")
    print(f"   Safe files: {total_files - suspicious_files - critical_files}")
    
    if critical_files > 0:
        print(f"\n🚨 CRITICAL: {critical_files} files require immediate review!")
        print("   DO NOT use these skills until manually audited.")
    elif suspicious_files > 0:
        print(f"\n⚠️  WARNING: {suspicious_files} files are suspicious.")
        print("   Review these files before use.")
    else:
        print("\n✅ All files appear safe (no high-risk patterns detected).")
    
    print("\n⚠️  Note: This scanner uses heuristics and may have false positives/negatives.")
    print("   Always manually review skill files before use.")

def main():
    if len(sys.argv) < 2:
        print("Usage: python audit-skills.py [directory]")
        print("Example: python audit-skills.py .openclaw/skills/")
        sys.exit(1)
    
    root_dir = sys.argv[1]
    
    if not os.path.exists(root_dir):
        print(f"Error: Directory '{root_dir}' does not exist.")
        sys.exit(1)
    
    audit_directory(root_dir)

if __name__ == "__main__":
    main()
