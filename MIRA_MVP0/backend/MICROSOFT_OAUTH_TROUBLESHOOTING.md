# Microsoft OAuth Troubleshooting Guide

## Issue: "Application was not found in the directory" for University/Work Accounts

### Problem
When users try to connect their university or work Microsoft account (e.g., `@pitt.edu`), they get an error:
```
AADSTS700016: Application with identifier '...' was not found in the directory 'University of Pittsburgh'
```

### Root Cause
Even though your Azure AD app is configured as **multi-tenant**, some organizational tenants (especially universities) have restrictions that require:
1. **Admin consent** for the application
2. Or the app needs to be explicitly added to their tenant

### Solutions

#### Solution 1: Configure App to Allow User Consent (Recommended)
1. Go to Azure Portal → Azure Active Directory → App registrations → Your MIRA app
2. Navigate to **API permissions**
3. Click **"Add a permission"** → **Microsoft Graph** → **Delegated permissions**
4. Add the required permissions:
   - `User.Read`
   - `Calendars.ReadWrite`
   - `Mail.Read`
5. **IMPORTANT**: Click **"Grant admin consent for [Your Organization]"** button
6. For multi-tenant apps, you may also need to:
   - Go to **Authentication** settings
   - Under **"Supported account types"**, ensure it's set to:
     - ✅ "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts"
   - Under **"Advanced settings"**, check if there are any tenant restrictions

#### Solution 2: Request Admin Consent URL
For organizational accounts that require admin consent, you can provide an admin consent URL:

```
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={your-client-id}
```

Replace:
- `{tenant-id}` with the organization's tenant ID (or use `common` for any tenant)
- `{your-client-id}` with your Microsoft Client ID

#### Solution 3: User Instructions
If users encounter this error, they should:
1. **Contact their IT administrator** to approve the MIRA application for their organization
2. **Or use a personal Microsoft account** (e.g., `@outlook.com`, `@hotmail.com`, `@live.com`) instead of their work/school email

### Code Changes Made

1. **Improved Error Handling** (`auth.py`):
   - Added specific error detection for `AADSTS700016` and consent-related errors
   - Provides user-friendly error messages explaining the issue

2. **Consent Prompt** (`auth.py`):
   - Changed `prompt` parameter to `"consent"` to explicitly request consent
   - This helps with organizational accounts that need consent

3. **Frontend Error Display** (`settings/page.tsx`):
   - Added error handling for Microsoft OAuth errors
   - Shows user-friendly alerts with guidance

### Testing
After making these changes:
1. Test with a personal Microsoft account (should work)
2. Test with a university/work account:
   - If admin consent is required, the user will see a clear error message
   - They can then contact their IT admin or use a personal account

### Additional Azure AD Configuration

Make sure your app registration has:
- ✅ Multi-tenant enabled
- ✅ Redirect URIs configured correctly
- ✅ API permissions granted (with admin consent if needed)
- ✅ No tenant restrictions blocking external apps

