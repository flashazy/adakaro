# Push Adakaro to GitHub – Step-by-Step Guide

Your project has a `.gitignore` that already excludes `node_modules`, `.next`, `.env*`, and other sensitive/build files. **Never commit `.env.local`** – it contains secrets.

---

## Step 1: Initialize Git and make the first commit

Run these commands in your terminal from the project folder:

```bash
cd /Users/macbookpro2017/adakaro

# Initialize Git
git init

# Add all files (respects .gitignore)
git add .

# Verify what will be committed (optional – should NOT show .env.local)
git status

# Create initial commit
git commit -m "Initial commit: Adakaro school fees app"
```

---

## Step 2: Create a repository on GitHub

### Option A: Manual (browser)

1. Go to [https://github.com/new](https://github.com/new)
2. **Repository name:** `adakaro` (or any name you prefer)
3. **Description:** (optional) e.g. "School fees management with ClickPesa"
4. Choose **Public** or **Private**
5. **Do NOT** check "Add a README" or "Add .gitignore" – you already have files
6. Click **Create repository**
7. GitHub will show you commands – **skip** the "create new repo" commands; use the "push an existing repository" section instead.

### Option B: GitHub CLI (if you install it)

```bash
# Install GitHub CLI (macOS)
brew install gh

# Log in (opens browser)
gh auth login

# Create repo and push in one go
gh repo create adakaro --public --source=. --remote=origin --push
```

If you use `gh repo create`, you can skip Steps 3 and 4 below.

---

## Step 3: Add the remote

Replace `YOUR_USERNAME` with your GitHub username and `adakaro` with your repo name if different:

```bash
git remote add origin https://github.com/YOUR_USERNAME/adakaro.git
```

To use SSH instead (if you have SSH keys set up):

```bash
git remote add origin git@github.com:YOUR_USERNAME/adakaro.git
```

---

## Step 4: Push to GitHub

```bash
# Ensure you're on main (or master)
git branch -M main

# Push
git push -u origin main
```

If Git asks for credentials, use a **Personal Access Token** (not your password) for HTTPS, or ensure SSH keys are configured for SSH.

---

## Step 5: Import into Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** and select your `adakaro` repo
3. Vercel will detect Next.js; keep the default settings
4. Before deploying, add **Environment Variables** in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLICKPESA_API_KEY` (BillPay API)
   - `CLICKPESA_CHECKSUM_SECRET` (webhook verification, if used)
   - `CLICKPESA_BASE_URL` (optional; default ClickPesa API base)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. `https://adakaro.vercel.app`)
   - Webhook URL in ClickPesa dashboard: `https://YOUR_DOMAIN/api/clickpesa/webhook`

5. Deploy.

---

## Quick reference – all commands (manual flow)

```bash
cd /Users/macbookpro2017/adakaro
git init
git add .
git commit -m "Initial commit: Adakaro school fees app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/adakaro.git
git push -u origin main
```

---

## Optional: Create `.env.example` for Vercel

Create a template so you (and others) know which env vars are needed. This file is safe to commit:

```bash
# Create .env.example (copy structure from .env.local, remove real values)
```

Add to `.gitignore` before `.env*`:

```
!.env.example
```

Then create `.env.example` with placeholder values (no real secrets).
