# API Key Rotation Guide

## CRITICAL: Exposed API Keys Requiring Rotation

The following API keys are currently exposed in plaintext in `.env` and should be rotated immediately.

---

## Keys to Rotate (8 Total)

### 1. Alpaca Trading API
**Current variables in .env:**
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`

**Rotation steps:**
1. Login to Alpaca: https://app.alpaca.markets/paper/dashboard/overview
2. Navigate to: API Keys section
3. Click: "Generate New Key"
4. Copy the new API Key and Secret Key
5. Update `.env`:
   ```bash
   ALPACA_API_KEY=<new_key>
   ALPACA_SECRET_KEY=<new_secret>
   ```
6. Delete the old key in Alpaca dashboard
7. Test: `npm run dev` and verify trading functionality

---

### 2. OpenRouter API
**Current variable in .env:**
- `OPENROUTER_API_KEY`

**Rotation steps:**
1. Login to OpenRouter: https://openrouter.ai/keys
2. Click: "Create Key"
3. Name it: "OMAR Platform - Prod"
4. Copy the key
5. Update `.env`: `OPENROUTER_API_KEY=<new_key>`
6. Delete the old key
7. Test: AI decision engine functionality

---

### 3. Groq API
**Current variable in .env:**
- `GROQ_API_KEY`

**Rotation steps:**
1. Login to Groq Console: https://console.groq.com/keys
2. Click: "Create API Key"
3. Copy the key
4. Update `.env`: `GROQ_API_KEY=<new_key>`
5. Delete the old key
6. Test: LLM fallback functionality

---

### 4. HuggingFace API
**Current variable in .env:**
- `HUGGINGFACE_API_KEY`

**Rotation steps:**
1. Login to HuggingFace: https://huggingface.co/settings/tokens
2. Click: "New token"
3. Select scope: Read (for inference API)
4. Copy the token
5. Update `.env`: `HUGGINGFACE_API_KEY=<new_key>`
6. Delete the old token
7. Test: Sentiment analysis (FinBERT)

---

### 5. Google Gemini API
**Current variable in .env:**
- `GOOGLE_GEMINI_API_KEY`

**Rotation steps:**
1. Login to Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Navigate to: API Keys
3. Click: "Create Credentials" → "API Key"
4. Restrict the key to Gemini API
5. Copy the key
6. Update `.env`: `GOOGLE_GEMINI_API_KEY=<new_key>`
7. Delete the old key
8. Test: Gemini LLM integration

---

### 6. AIML API
**Current variable in .env:**
- `AIMLAPI_KEY`

**Rotation steps:**
1. Login to AIML API dashboard
2. Navigate to API Keys section
3. Generate new key
4. Update `.env`: `AIMLAPI_KEY=<new_key>`
5. Delete old key
6. Test: AIML integration points

---

### 7. Cloudflare Account
**Current variable in .env:**
- `CLOUDFLARE_ACCOUNT_ID`

**Note:** This is an account ID, not a secret token. If this is just an identifier (not a secret), rotation may not be necessary. However, if sensitive:

**Rotation steps:**
1. Login to Cloudflare: https://dash.cloudflare.com
2. Navigate to Account settings
3. If using API tokens: Generate new token in API Tokens section
4. Update `.env` with new credentials
5. Test: Cloudflare integrations

---

## Security Best Practices

### After Rotation

1. **Verify old keys are revoked** in each service
2. **Test all integrations** to ensure new keys work
3. **Update production environment** variables (if deployed)
4. **Document rotation** in audit log:
   ```bash
   echo "$(date -Iseconds) - API keys rotated" >> ./analysis/security-audit.log
   ```

### Ongoing Security

1. **Never commit .env**
   - Already added to `.gitignore` ✓
   - Verify: `git check-ignore .env` should return `.env`

2. **Use environment-specific files**
   - `.env.local` for development
   - `.env.production` for production
   - Keep `.env.example` updated (without secrets)

3. **Regular rotation schedule**
   - Rotate keys quarterly (every 3 months)
   - Rotate immediately after team member leaves
   - Rotate if suspicious activity detected

4. **Monitor API usage**
   - Check Alpaca dashboard for unusual trading
   - Monitor LLM API usage/costs
   - Set up billing alerts

---

## Validation Checklist

After rotating all keys:

- [ ] Alpaca: Trading executes successfully
- [ ] OpenRouter: AI decisions generate
- [ ] Groq: LLM calls work
- [ ] HuggingFace: Sentiment analysis runs
- [ ] Google Gemini: Gemini integration works
- [ ] AIML: Integration points functional
- [ ] Cloudflare: (if applicable) services work
- [ ] All tests pass: `npm test`
- [ ] Dev server starts: `npm run dev`
- [ ] No errors in logs

---

## Emergency: Key Compromised

If a key is actively compromised:

1. **Immediately revoke** the key in the service dashboard
2. **Check audit logs** for unauthorized access
3. **Review billing** for unexpected charges
4. **Generate new key** immediately
5. **Update application** and restart services
6. **Monitor for 48 hours** for any issues
7. **Document incident** for security review

---

## Notes

- All keys are currently in **paper trading mode** (Alpaca)
- No production funds at risk currently
- However, other API keys could incur costs if abused
- Rotation is still recommended as a security best practice
