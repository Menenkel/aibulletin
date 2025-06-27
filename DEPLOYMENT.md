# Deployment Guide

This guide explains how to deploy the Experimental AI Drought Bulletins application to production.

## 🚀 Quick Deployment Options

### Option 1: Railway (Recommended - Easiest)

#### Backend Deployment:
1. **Sign up for Railway** (railway.app)
2. **Connect your GitHub repository**
3. **Railway will auto-detect Python and deploy your backend**
4. **Set environment variables:**
   - `OPENAI_API_KEY` (your OpenAI API key)
5. **Get your deployment URL** (e.g., `https://your-app.railway.app`)

#### Frontend Deployment:
1. **Deploy to Netlify:**
   - Connect your GitHub repo to Netlify
   - Set build settings:
     - Build command: `cd frontend && npm install && npm run build`
     - Publish directory: `frontend/dist`
   - Set environment variable:
     - `VITE_API_BASE_URL`: Your Railway backend URL

### Option 2: Render (Free Tier Available)

#### Backend Deployment:
1. **Sign up for Render** (render.com)
2. **Create a new Web Service**
3. **Connect your GitHub repository**
4. **Configure:**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Environment: Python 3
5. **Set environment variables:**
   - `OPENAI_API_KEY`

#### Frontend Deployment:
1. **Create a new Static Site on Render**
2. **Configure:**
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`
   - Environment Variable: `VITE_API_BASE_URL`

### Option 3: Vercel + Railway

#### Backend (Railway):
- Follow Railway deployment steps above

#### Frontend (Vercel):
1. **Deploy to Vercel** (vercel.com)
2. **Import your GitHub repository**
3. **Configure:**
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Environment Variable: `VITE_API_BASE_URL`

## 🔧 Environment Configuration

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# For local development
VITE_API_BASE_URL=http://localhost:8000

# For production (replace with your backend URL)
# VITE_API_BASE_URL=https://your-backend.railway.app
```

### Backend Environment Variables

Set these in your deployment platform:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## 📁 File Structure for Deployment

```
your-repo/
├── backend/           # Python FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── frontend/          # React frontend
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md
```

## 🔒 Security Considerations

1. **API Keys:** Never commit API keys to your repository
2. **CORS:** Update backend CORS settings for production domains
3. **Rate Limiting:** Consider implementing rate limiting for production
4. **Environment Variables:** Use platform-specific environment variable systems

## 🐛 Troubleshooting

### Common Issues:

1. **CORS Errors:**
   - Update backend CORS origins to include your frontend domain
   - Add `https://your-frontend-domain.com` to allowed origins

2. **API Key Not Found:**
   - Ensure environment variables are set correctly
   - Check that the backend can access the API key

3. **Build Failures:**
   - Ensure all dependencies are in `requirements.txt` (backend) and `package.json` (frontend)
   - Check that Python and Node.js versions are compatible

4. **PDF Processing Issues:**
   - Ensure PyPDF2 is installed in the backend environment
   - Check that the deployment platform supports file downloads

## 📊 Monitoring

- **Railway:** Built-in logs and monitoring
- **Render:** Application logs and metrics
- **Netlify:** Build logs and function logs
- **Vercel:** Function logs and analytics

## 🔄 Continuous Deployment

Once set up, your application will automatically deploy when you push changes to your GitHub repository's main branch.

## 💰 Cost Considerations

- **Railway:** Free tier available, then pay-as-you-go
- **Render:** Free tier available for static sites and web services
- **Netlify:** Free tier available
- **Vercel:** Free tier available

## 🆘 Support

If you encounter issues:
1. Check the platform-specific documentation
2. Review application logs
3. Ensure all environment variables are set correctly
4. Verify that your API keys are valid and have sufficient credits 