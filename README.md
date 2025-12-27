# 🤖 WhatsApp Community Manager Bot

A friendly WhatsApp bot that helps group admins manage their communities by reducing spam, enforcing rules, and keeping conversations on-topic.

## 📋 What Does This Bot Do?

This bot acts as your community assistant and helps you:

- **Stop spam** - Automatically detects and warns users sending spam, links, or flooding messages
- **Enforce rules** - Keeps conversations on-topic and filters inappropriate content
- **Welcome new members** - Automatically greets new members with group rules
- **Reduce admin stress** - Handles routine moderation tasks so you don't have to

All configuration is done through simple WhatsApp commands - no coding or file editing required!

## 👥 Who Is This For?

- Community group admins who want to reduce spam
- Group owners tired of manual moderation
- Anyone managing active WhatsApp groups
- **No technical knowledge required!**

## 🚀 How to Run the Bot

### Step 1: Install Node.js

First, you need Node.js installed on your computer. 

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS version** (recommended for most users)
3. Run the installer and follow the instructions
4. To verify it's installed, open Terminal and type: `node --version`

### Step 2: Download the Bot

1. Download this project folder to your computer
2. Open Terminal (on Mac) or Command Prompt (on Windows)
3. Navigate to the project folder:
   ```bash
   cd "path/to/Community Bot Project"
   ```

### Step 3: Install Dependencies

In the Terminal, run:
```bash
npm install
```

This will download all the necessary files the bot needs to run.

### Step 4: Start the Bot

Run this command:
```bash
npm start
```

### Step 5: Scan the QR Code

1. A QR code will appear in your Terminal
2. Open WhatsApp on your phone
3. Go to **Settings** → **Linked Devices** → **Link a Device**
4. Scan the QR code shown in Terminal

**That's it!** The bot is now running and connected to your WhatsApp.

### Step 6: Add Bot to Your Group

1. Add the WhatsApp account (the one you scanned the QR code with) to your group
2. **Make the bot an admin** - this is required for moderation features to work
3. The bot will start working automatically!

## 💬 Common Commands

Once the bot is in your group, admins can use these commands:

### Getting Help
- `!help` - Show all available commands

### Managing Rules
- `!rules` - Show current group rules
- `!rules add <rule>` - Add a new rule
- `!rules remove <number>` - Remove a rule

### Moderation
- `!warn @user [reason]` - Send a friendly warning to a user
- `!status` - See bot statistics and current settings

### Configuration
- `!topic <topic>` - Set what your group is about (enables off-topic detection)
- `!links on` - Block links (sends warnings when users post links)
- `!links off` - Allow links
- `!settings` - View all current settings

### Examples

```
!rules add Be respectful to everyone
!topic Technology and Programming
!links on
!warn @john Please avoid spam messages
```

## 🔧 Troubleshooting

### QR Code Won't Scan
- Make sure you're using WhatsApp on your phone (not WhatsApp Web)
- Try closing and restarting the bot with `npm start`
- Check that your phone has a good internet connection

### Bot Not Responding
- Make sure the bot is an **admin** in your group
- Check that the Terminal window is still running
- Try restarting the bot

### "npm: command not found"
- Node.js is not installed correctly
- Go back to Step 1 and reinstall Node.js
- After installing, close and reopen Terminal

### Bot Stops Working After Computer Restarts
- The bot only runs when your computer is on and the Terminal is running
- You need to run `npm start` again after restarting your computer
- Consider running the bot on a server or cloud service for 24/7 operation

### Session Expired / Need to Scan QR Again
- Sometimes WhatsApp sessions expire
- Just run `npm start` again and scan the new QR code
- Your settings and configurations are saved automatically

## ⚙️ Default Settings

The bot works out-of-the-box with these settings:

- ✅ Spam detection enabled
- ✅ Welcome messages enabled
- ✅ Warnings enabled
- ❌ Auto-delete disabled (warnings only)
- ❌ Link blocking disabled (can be enabled with `!links on`)

All settings can be changed using WhatsApp commands - no file editing needed!

## 🛡️ Privacy & Safety

- The bot only reads messages in groups where it's added
- All data is stored locally on your computer
- No messages are sent to external servers
- Session data is saved in `.wwebjs_auth` folder (don't delete this!)

## 📝 Notes for Developers

This is an open-source project built with:
- **Node.js** - JavaScript runtime
- **whatsapp-web.js** - WhatsApp Web API wrapper
- **qrcode-terminal** - QR code display in terminal

### Project Structure
```
Community Bot Project/
├── src/
│   ├── index.js              # Main entry point
│   ├── client.js             # WhatsApp client wrapper
│   ├── handlers/             # Message and command handlers
│   ├── commands/             # Command implementations
│   ├── moderation/           # Spam detection, rule enforcement
│   ├── config/               # Configuration management
│   └── utils/                # Logging, permissions
├── data/                     # Config storage (auto-created)
├── package.json              # Project dependencies
└── README.md                 # This file
```

### Running in Development
```bash
npm run dev
```

### Contributing
Contributions are welcome! Please keep the focus on:
- User-friendliness for non-technical users
- Community management features
- Clean, modular code

## 📄 License

MIT License - feel free to use and modify for your community!

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.

**Enjoying the bot?** Star the project and share it with other community admins! ⭐
