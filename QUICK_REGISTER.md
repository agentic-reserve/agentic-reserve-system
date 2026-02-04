# Quick Registration Guide - Colosseum Hackathon

## 🚀 Quick Start

### 1. Get Your API Key
1. Visit https://colosseum.com
2. Login with your account
3. Go to Settings → API Keys
4. Copy your API key

### 2. Setup Environment
```bash
# Copy example file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your favorite editor
```

Add this line to `.env`:
```
COLOSSEUM_API_KEY=your-api-key-here
```

### 3. Register Project

**Git Bash / Linux / macOS:**
```bash
bash scripts/register-ars-colosseum.sh
```

**PowerShell:**
```powershell
.\scripts\register-ars-colosseum.ps1
```

### 4. Verify
Visit https://colosseum.com/dashboard to see your registered project.

## 📋 Project Details

- **Name**: Agentic Reserve System
- **Team**: ars-team
- **Agent**: ars-agent (ID: 268)
- **GitHub**: https://github.com/protocoldaemon-sec/agentic-reserve-system.git

## 🎯 Next Steps

1. ✅ Register project (you're here!)
2. 🔨 Build and deploy programs
3. 🎥 Create demo video
4. 🔗 Update demo links
5. 📝 Post on forum
6. 🏆 Submit to judges

## 📝 Update Demo Links

After deploying, edit `scripts/register-ars-colosseum.sh` and update:
- `technicalDemoLink`: Your live demo URL
- `presentationLink`: Your YouTube video URL

Then run the script again to update.

## 🎬 Submit to Judges

**Only when ready!**

```bash
curl -X POST https://api.colosseum.org/v1/my-project/submit \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY"
```

## 📚 Full Documentation

See [COLOSSEUM_REGISTRATION.md](./COLOSSEUM_REGISTRATION.md) for complete details.

---

**Need Help?**
- Check [README.md](./README.md) for project overview
- See [QUICK_START.md](./QUICK_START.md) for build instructions
- Open an issue on GitHub

