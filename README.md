# 🌺 Emma - Tobago Tourism Survey Concierge

Emma is an AI-powered tourism survey chatbot for Tobago. She provides a fun, gamified survey experience that collects visitor information while making tourists feel welcomed to the island.

![Emma Chat Interface](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)

## ✨ Features

- **WhatsApp-like Chat Interface** - Familiar, mobile-first design
- **AI-Powered Personalization** - Unique responses for every conversation using GPT-4o-mini
- **Gamified Survey Flow** - Fun animations, celebrations, and progress tracking
- **Multi-Choice Questions** - Arrival method, star ratings, activity preferences
- **Real-time Database** - Survey responses saved to Neon PostgreSQL
- **Beautiful Animations** - Smooth transitions, confetti celebrations, typing indicators

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Neon PostgreSQL database
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/ultratelecom/emma_tourism.git
cd emma_tourism

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```env
# Database - Neon PostgreSQL
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# OpenAI API Key (for AI-personalized responses)
OPENAI_API_KEY="sk-..."
```

### Database Setup

Run this SQL to create the required table:

```sql
CREATE TABLE IF NOT EXISTS emma_surveys (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    arrival_method VARCHAR(50) NOT NULL,
    journey_rating INTEGER NOT NULL CHECK (journey_rating >= 1 AND journey_rating <= 5),
    activity_interest VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emma_surveys_email ON emma_surveys (email);
CREATE INDEX IF NOT EXISTS idx_emma_surveys_created_at ON emma_surveys (created_at);
```

## 🌐 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ultratelecom/emma_tourism)

### Vercel Environment Variables

Add these in your Vercel project settings:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key for AI responses |

## 📁 Project Structure

```
├── app/
│   ├── emma/
│   │   ├── page.tsx        # Main Emma chat interface
│   │   └── layout.tsx      # Emma-specific metadata
│   ├── api/
│   │   └── emma/
│   │       ├── survey/     # POST - Save survey responses
│   │       ├── stats/      # GET - Survey statistics
│   │       └── ai-response/ # POST - AI-generated responses
│   └── globals.css         # Tropical theme & animations
├── lib/
│   ├── db.ts              # Database connection
│   └── emma-db.ts         # Emma survey functions
└── public/
    └── emma-avatar.png    # Emma's avatar (add your own)
```

## 🎨 Customization

### Emma's Avatar
Replace `public/emma-avatar.png` with your own AI-generated avatar (recommended: 200x200px square).

### Colors & Theme
Edit the CSS variables in `app/globals.css`:
```css
:root {
  --primary: #ff6b6b;      /* Coral */
  --accent: #ffd166;       /* Sunset Gold */
  --emma-ocean-blue: #4ecdc4;
  --emma-palm-green: #7ed957;
}
```

### Survey Questions
Edit `EMMA_MESSAGES` in `app/emma/page.tsx` to customize questions.

## 📊 API Endpoints

### POST `/api/emma/survey`
Save completed survey response.

```json
{
  "session_id": "unique-session-id",
  "name": "John Doe",
  "email": "john@example.com",
  "arrival_method": "cruise",
  "journey_rating": 5,
  "activity_interest": "beach"
}
```

### GET `/api/emma/stats`
Get survey statistics and recent submissions.

### POST `/api/emma/ai-response`
Generate AI-personalized response.

```json
{
  "type": "name_reaction",
  "context": { "name": "Maria" }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ for Tobago Tourism 🌴
