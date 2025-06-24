import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const VENDOR_TYPE = process.env.VENDOR_TYPE || 'sync';

app.use(cors());
app.use(express.json());

let requestCount = 0;
const rateLimit = 5;
const rateLimitWindow = 60000;

setInterval(() => {
  requestCount = 0;
}, rateLimitWindow);

if (VENDOR_TYPE === 'sync') {
  app.post('/sync-vendor', (req, res) => {
    requestCount++;
    
    if (requestCount > rateLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateLimitWindow / 1000)
      });
    }
    
    setTimeout(() => {
      const response = {
        id: Math.random().toString(36).substr(2, 9),
        data: req.body,
        timestamp: new Date().toISOString(),
        source: 'sync-vendor',
        rawData: {
          userEmail: 'user@example.com',
          phoneNumber: '+1234567890',
          address: '  123 Main St, City, State 12345  ',
          preferences: ['pref1', 'pref2', 'pref3']
        }
      };
      
      res.json(response);
    }, 1000 + Math.random() * 2000);
  });
  
  console.log(`Sync vendor mock running on port ${PORT}`);
} else {
  app.post('/async-vendor', (req, res) => {
    requestCount++;
    
    if (requestCount > rateLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateLimitWindow / 1000)
      });
    }
    
    const acknowledgment = {
      jobId: Math.random().toString(36).substr(2, 9),
      status: 'accepted',
      estimatedCompletion: new Date(Date.now() + 5000).toISOString()
    };
    
    res.json(acknowledgment);
    
    setTimeout(() => {
      const finalResponse = {
        id: acknowledgment.jobId,
        data: req.body,
        timestamp: new Date().toISOString(),
        source: 'async-vendor',
        rawData: {
          userEmail: 'user@example.com',
          phoneNumber: '+1234567890',
          address: '  123 Main St, City, State 12345  ',
          preferences: ['pref1', 'pref2', 'pref3'],
          additionalData: {
            creditScore: 750,
            lastPurchase: '2023-12-01'
          }
        }
      };
      
      fetch('http://api:3000/api/vendor-webhook/async-vendor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalResponse)
      }).catch(err => {
        console.error('Failed to send webhook:', err);
      });
    }, 3000 + Math.random() * 4000);
  });
  
  console.log(`Async vendor mock running on port ${PORT}`);
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    vendor_type: VENDOR_TYPE,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`${VENDOR_TYPE} vendor mock server running on port ${PORT}`);
}); 