/**
 * build.js - Environment Variable Injection Build Tool
 * 
 * SavanaTattoos — Tattoo studio inquiry and management system.
 * 
 * 1. Reads .env (local) or process.env (Vercel)
 * 2. Injects SUPABASE_URL and SUPABASE_ANON_KEY into HTML
 * 3. Copies all static assets to /public
 */

const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURATION ---
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Files to process (inject env vars)
const HTML_FILES = ['index.html', 'admin.html'];

// Files to copy as-is
const STATIC_FILES = ['styles.css', 'script.js', 'admin.js', 'utils.js'];
const STATIC_DIRS = ['assets'];

// --- 2. LOAD ENVIRONMENT VARIABLES ---
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
    console.log('Loading local .env file...');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[key] = value.trim();
        }
    });
}

const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
};

if (!envVars.SUPABASE_URL || !envVars.SUPABASE_ANON_KEY) {
    console.warn('WARNING: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment.');
    console.warn('   Injection will use empty strings or placeholders.');
}

// --- 3. PREPARE PUBLIC DIRECTORY ---
if (fs.existsSync(PUBLIC_DIR)) {
    console.log('Cleaning existing /public directory...');
    fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
}
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// --- 4. PROCESS HTML FILES ---
HTML_FILES.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(PUBLIC_DIR, file);

    if (!fs.existsSync(srcPath)) return;

    console.log(`Processing ${file}...`);
    let content = fs.readFileSync(srcPath, 'utf8');

    const envScriptBlock = `<script id="env-script">
      window.__ENV__ = {
        "SUPABASE_URL": "${envVars.SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${envVars.SUPABASE_ANON_KEY}"
      };
    </script>`;

    const placeholderRegex = /<!-- ENV_PLACEHOLDER_START -->[\s\S]*?<!-- ENV_PLACEHOLDER_END -->/;
    const replacement = `<!-- ENV_PLACEHOLDER_START -->\n    ${envScriptBlock}\n    <!-- ENV_PLACEHOLDER_END -->`;
    
    content = content.replace(placeholderRegex, replacement);
    
    fs.writeFileSync(destPath, content);
});

// --- 5. COPY STATIC ASSETS ---
STATIC_FILES.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(PUBLIC_DIR, file);

    if (fs.existsSync(srcPath)) {
        console.log(`Copying ${file} to /public...`);
        fs.copyFileSync(srcPath, destPath);
    }
});

STATIC_DIRS.forEach(dir => {
    const srcPath = path.join(ROOT_DIR, dir);
    const destPath = path.join(PUBLIC_DIR, dir);

    if (fs.existsSync(srcPath)) {
        console.log(`Copying directory ${dir} to /public...`);
        fs.cpSync(srcPath, destPath, { recursive: true });
    }
});

console.log('Build Complete! Deployment ready in /public');
