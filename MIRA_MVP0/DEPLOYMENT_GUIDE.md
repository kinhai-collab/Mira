# 🚀 AWS Amplify Deployment Guide for MIRA MVP

## Overview
This guide will help you deploy your FastAPI backend and Next.js frontend to AWS Amplify.

## Architecture
- **Frontend**: Next.js app deployed to AWS Amplify
- **Backend**: FastAPI app deployed as AWS Lambda function via API Gateway

## Prerequisites
- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Node.js and npm installed
- Python 3.9+ installed

## Step 1: Deploy Backend to AWS Lambda

### 1.1 Install Serverless Framework (if not already installed)
```bash
npm install -g serverless
```

### 1.2 Configure AWS CLI
```bash
aws configure
```
Enter your AWS Access Key ID, Secret Access Key, region (e.g., us-east-1), and output format (json).

### 1.3 Deploy Backend
```bash
cd MIRA_MVP0/backend
serverless deploy
```

This will:
- Create a Lambda function with your FastAPI app
- Set up API Gateway endpoints
- Output the API Gateway URL (save this URL!)

### 1.4 Get the API Gateway URL
After deployment, you'll see output like:
```
endpoints:
  ANY - https://xxxxxx.execute-api.us-east-1.amazonaws.com/dev/{proxy+}
  ANY - https://xxxxxx.execute-api.us-east-1.amazonaws.com/dev/
```

**Save this URL** - you'll need it for the frontend configuration.

## Step 2: Deploy Frontend to AWS Amplify

### 2.1 Prepare Frontend Environment
1. Copy the API Gateway URL from Step 1.4
2. In AWS Amplify Console, you'll set this as an environment variable

### 2.2 Deploy via AWS Amplify Console

#### Option A: Connect to Git Repository
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Choose your Git provider (GitHub, GitLab, etc.)
4. Select your repository
5. Configure build settings:
   - **App root**: `frontend`
   - **Build spec**: Use the provided `amplify.yml`
6. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your API Gateway URL from Step 1.4
7. Review and deploy

#### Option B: Deploy from Local Build
1. Build your frontend locally:
   ```bash
   cd MIRA_MVP0/frontend
   npm run build
   ```
2. Upload the `.next` folder to AWS Amplify

### 2.3 Configure Build Settings
If deploying via Git, Amplify will use the `amplify.yml` file automatically. The configuration includes:
- Frontend build process
- Backend dependency installation
- Proper caching for faster builds

## Step 3: Environment Variables

### Frontend Environment Variables (set in Amplify Console):
- `NEXT_PUBLIC_API_URL`: Your API Gateway URL
- `NODE_ENV`: production

### Backend Environment Variables (set in serverless.yml):
- `STAGE`: dev/prod
- Add any other environment variables your app needs

## Step 4: Custom Domain (Optional)

1. In Amplify Console, go to your app
2. Click "Domain management"
3. Add your custom domain
4. Follow the DNS configuration steps

## Step 5: Monitoring and Updates

### Backend Updates:
```bash
cd MIRA_MVP0/backend
serverless deploy
```

### Frontend Updates:
- If connected to Git: Push to your repository
- Amplify will automatically detect changes and redeploy

## Troubleshooting

### Common Issues:

1. **CORS Errors**: 
   - Ensure your FastAPI app has CORS middleware configured
   - Check that API Gateway is properly configured

2. **Environment Variables Not Working**:
   - Make sure variables are prefixed with `NEXT_PUBLIC_` for client-side access
   - Restart your Amplify build after adding new variables

3. **Build Failures**:
   - Check the build logs in Amplify Console
   - Ensure all dependencies are properly listed in package.json

4. **API Not Reachable**:
   - Verify the API Gateway URL is correct
   - Check Lambda function logs in CloudWatch

### Useful Commands:

```bash
# Check backend logs
serverless logs -f api

# Remove backend deployment
serverless remove

# Local development
cd MIRA_MVP0/backend
python -m uvicorn main:app --reload

cd MIRA_MVP0/frontend
npm run dev
```

## Cost Considerations

- **AWS Lambda**: Pay per request (very cheap for small apps)
- **API Gateway**: Pay per request
- **Amplify Hosting**: Free tier available, then pay per build minute
- **CloudWatch Logs**: Minimal cost for small applications

## Security Notes

1. **Environment Variables**: Never commit sensitive data to Git
2. **CORS**: Configure properly for production domains
3. **API Keys**: Store securely in environment variables
4. **HTTPS**: Amplify provides SSL certificates automatically

## Next Steps

1. Set up monitoring with CloudWatch
2. Configure custom domain
3. Set up CI/CD pipeline
4. Add automated testing
5. Implement proper error handling and logging

---

## Files Created/Modified:

- `amplify.yml` - Amplify build configuration
- `backend/lambda_handler.py` - Lambda handler for FastAPI
- `backend/serverless.yml` - Serverless deployment configuration
- `backend/package.json` - Backend dependencies
- `backend/requirements.txt` - Updated with Lambda dependencies
- `frontend/next.config.ts` - Updated with API routing
- `frontend/env.example` - Environment variables template

Your project is now ready for AWS Amplify deployment! 🎉
