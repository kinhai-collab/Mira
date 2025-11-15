# MIRA Backend - Pre-Deployment Checklist

## ✅ Fixed Issues
- [x] Removed duplicate dependencies in requirements.txt
- [x] Added version pins to all packages
- [x] Updated CORS to use FRONTEND_URL environment variable

## ⚠️ IMPORTANT: Before Running `serverless deploy`

### 1. **Add Missing Stripe Environment Variables**
Your `serverless.yml` is missing Stripe configuration. Add these to the `environment:` section:

```yaml
STRIPE_SECRET_KEY: "sk_test_..." # or sk_live_... for production
STRIPE_WEBHOOK_SECRET: "whsec_..."
```

**⚠️ SECURITY WARNING:** Your `serverless.yml` currently has hardcoded API keys. For production:
- Use AWS Systems Manager Parameter Store
- Use AWS Secrets Manager
- Or at minimum, use environment variables with `${env:VARIABLE_NAME}`

### 2. **Environment Variables to Verify**

Ensure these are all set correctly in `serverless.yml`:

| Variable | Status | Notes |
|----------|--------|-------|
| SUPABASE_URL | ✅ Set | 
| SUPABASE_KEY | ✅ Set |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Set |
| ELEVENLABS_API_KEY | ✅ Set |
| ELEVENLABS_VOICE_ID | ✅ Set |
| GOOGLE_CLIENT_ID | ✅ Set |
| GOOGLE_CLIENT_SECRET | ✅ Set |
| GOOGLE_REDIRECT_URI | ✅ Set |
| MICROSOFT_CLIENT_ID | ✅ Set |
| MICROSOFT_CLIENT_SECRET | ✅ Set |
| MICROSOFT_REDIRECT_URI | ✅ Set |
| OPENAI_API_KEY | ✅ Set |
| FRONTEND_URL | ✅ Set |
| API_BASE_URL | ✅ Set |
| STRIPE_SECRET_KEY | ❌ Missing |
| STRIPE_WEBHOOK_SECRET | ❌ Missing |

### 3. **Lambda Configuration Review**

Current settings:
```yaml
memorySize: 2048  # Consider starting with 1024MB
timeout: 60       # Good for API operations
runtime: python3.11
```

**Recommendation:** Start with 1024MB memory and monitor CloudWatch metrics. You can always increase if needed.

### 4. **Files Excluded from Deployment**

Your `serverless.yml` excludes:
- `node_modules/**`
- `**/__pycache__/**`
- `**/*.mp3`, `**/*.wav` (audio files)
- `**/*.md` (documentation)
- `**/tests/**`

✅ This is good for reducing package size.

### 5. **Pre-Deployment Commands**

Before deploying, ensure you have:

```bash
# Install Node dependencies (serverless framework)
npm install

# Install Python dependencies locally to test
pip install -r requirements.txt

# Verify serverless configuration
npx serverless print

# Test locally (optional)
# uvicorn main:app --reload
```

### 6. **Deployment Commands**

```bash
# Deploy to dev stage (default)
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Or directly with serverless
npx serverless deploy --stage dev
```

### 7. **Post-Deployment Verification**

After deployment, test these endpoints:

1. **Health Check:**
   ```bash
   curl https://YOUR_API_URL/test
   ```

2. **Environment Check:**
   ```bash
   curl https://YOUR_API_URL/envcheck
   ```

3. **OAuth Redirects:** Verify these URLs are added to:
   - Google Cloud Console OAuth credentials
   - Microsoft Azure App registrations
   
   Your redirect URIs will be:
   - Gmail: `https://YOUR_API_URL/gmail/auth/callback`
   - Google Calendar: `https://YOUR_API_URL/google/calendar/oauth/callback`
   - Microsoft: `https://YOUR_API_URL/microsoft/auth/callback`

### 8. **CloudWatch Monitoring**

After deployment, monitor:
- Lambda function logs in CloudWatch
- API Gateway logs
- Cold start times
- Error rates
- Memory usage (to optimize memorySize)

### 9. **Known Issues to Monitor**

1. **Cold Starts:** First request after idle will be slower (3-5s)
2. **Package Size:** Current setup may be large due to dependencies
3. **Timeout:** Watch for operations that might exceed 60s

### 10. **Cost Optimization Tips**

- Monitor Lambda invocation count
- Consider provisioned concurrency for production
- Review memory allocation after 1 week of metrics
- Set up billing alerts in AWS

## 🔐 Security Recommendations

### High Priority:
1. **Move secrets to AWS Secrets Manager or Parameter Store**
2. **Enable API Gateway throttling**
3. **Set up AWS WAF for API Gateway**
4. **Rotate API keys regularly**
5. **Enable CloudTrail for audit logs**

### Medium Priority:
1. Add request validation at API Gateway level
2. Implement rate limiting per user
3. Add API key authentication for sensitive endpoints
4. Enable CORS only for specific origins (not `*`)

## 📊 Deployment Checklist

- [ ] Add STRIPE_SECRET_KEY to serverless.yml
- [ ] Add STRIPE_WEBHOOK_SECRET to serverless.yml
- [ ] Verify all OAuth redirect URIs in Google/Microsoft consoles
- [ ] Test locally with `uvicorn main:app --reload`
- [ ] Run `npm install` to install serverless plugins
- [ ] Run `npx serverless print` to verify configuration
- [ ] Deploy to dev: `npm run deploy:dev`
- [ ] Test all endpoints after deployment
- [ ] Update frontend with new API URL
- [ ] Set up CloudWatch alarms
- [ ] Configure Stripe webhook endpoint with deployed URL

## 🚀 Ready to Deploy?

Once you've completed the checklist above, run:

```bash
cd MIRA_MVP0/backend
npm run deploy:dev
```

The deployment will:
1. Package your Python dependencies using Docker
2. Upload to AWS Lambda
3. Create/update API Gateway
4. Output your API endpoint URL

Save the API URL and update your frontend's `API_BASE_URL` environment variable.

## 📞 Support

If you encounter issues:
1. Check CloudWatch Logs: AWS Console → CloudWatch → Log Groups → `/aws/lambda/mira-backend-dev-api`
2. Verify IAM permissions for Lambda execution role
3. Check API Gateway logs
4. Review serverless deployment output for errors

