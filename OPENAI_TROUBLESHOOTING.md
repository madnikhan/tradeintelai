# 🔧 OpenAI API Troubleshooting Guide

**Common issues and solutions for GPT integration**

---

## ❌ "Failed to generate explanation" Error

### **Possible Causes:**

1. **Model Name Issue**
   - GPT-5.1 might not be available yet or needs different identifier
   - Solution: Using `gpt-4o` (most reliable, widely available)

2. **API Key Issue**
   - Invalid or expired API key
   - Key not loaded from environment

3. **API Error**
   - Rate limiting
   - Invalid request format
   - Network issues

---

## 🔍 Debugging Steps

### **Step 1: Check Browser Console**

Open browser DevTools (F12) and check Console tab for errors:

```javascript
// Look for errors like:
OpenAI API Error: { status: 401, error: { message: "Invalid API key" } }
```

### **Step 2: Verify API Key**

Check if API key is loaded:

```javascript
// In browser console:
console.log(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
// Should show your API key (starts with sk-)
```

### **Step 3: Check Network Tab**

1. Open DevTools → Network tab
2. Filter by "openai"
3. Click on the failed request
4. Check:
   - Request payload
   - Response status
   - Response body (error message)

---

## 🛠️ Common Fixes

### **Fix 1: Model Name**

**Issue:** Model `gpt-5.1` might not be available

**Solution:** Updated to `gpt-4o` (most reliable)

To change model, edit `lib/openai-service.ts`:

```typescript
model: 'gpt-4o', // Current - most reliable
// Alternatives:
// 'gpt-4-turbo' - GPT-4 Turbo
// 'gpt-3.5-turbo' - Cheaper option
```

### **Fix 2: API Key Not Loading**

**Issue:** Environment variable not loaded

**Solution:**
1. Check `.env.local` exists
2. Restart dev server after adding key
3. Verify key format: `NEXT_PUBLIC_OPENAI_API_KEY=sk-...`

### **Fix 3: API Rate Limits**

**Issue:** Too many requests

**Solution:**
- Wait a few minutes
- Check OpenAI dashboard for rate limits
- Implement request throttling (already has caching)

### **Fix 4: Invalid API Key**

**Issue:** API key is invalid or expired

**Solution:**
1. Verify key in OpenAI dashboard
2. Check key starts with `sk-`
3. Ensure key has API access enabled
4. Generate new key if needed

---

## 📋 Model Options

### **Available Models:**

| Model | Identifier | Status | Best For |
|-------|-----------|--------|----------|
| GPT-4o | `gpt-4o` | ✅ Available | **Recommended** - Best balance |
| GPT-4 Turbo | `gpt-4-turbo` | ✅ Available | High quality |
| GPT-3.5 Turbo | `gpt-3.5-turbo` | ✅ Available | Cost-effective |
| GPT-5.1 | `gpt-5.1` | ⚠️ May need special setup | Latest (if available) |

### **Current Setting:**

```typescript
model: 'gpt-4o' // Most reliable option
```

---

## 🔧 Error Messages Explained

### **"Invalid API key" (401)**
- API key is wrong or expired
- Solution: Check key in `.env.local`, regenerate if needed

### **"Model not found" (404)**
- Model name is incorrect
- Solution: Use `gpt-4o` or `gpt-4-turbo`

### **"Rate limit exceeded" (429)**
- Too many requests
- Solution: Wait a few minutes, check usage limits

### **"Insufficient quota" (429)**
- Account has no credits
- Solution: Add credits to OpenAI account

### **"Network error"**
- Connection issue
- Solution: Check internet, try again

---

## ✅ Quick Fix Checklist

- [ ] API key in `.env.local` (starts with `sk-`)
- [ ] Dev server restarted after adding key
- [ ] Model name is correct (`gpt-4o`)
- [ ] Check browser console for specific error
- [ ] Verify API key in OpenAI dashboard
- [ ] Check account has credits/quota
- [ ] Try different model if needed

---

## 🧪 Test API Key

Test your API key directly:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Should return list of available models.

---

## 📞 Need Help?

1. Check browser console for detailed error
2. Check Network tab for API response
3. Verify API key in OpenAI dashboard
4. Try different model (`gpt-4-turbo` or `gpt-3.5-turbo`)
5. Check OpenAI status page

---

## 🔄 Current Status

**Model:** `gpt-4o` (most reliable)  
**Error Handling:** Improved with detailed logging  
**Fallback:** Graceful degradation (shows error, doesn't break)

**Check browser console for specific error message!**

