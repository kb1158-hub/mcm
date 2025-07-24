// Create: netlify/functions/trigger-alert.js
// This endpoint allows you to manually trigger alerts for testing

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      console.log('Manual alert trigger requested');
      
      // You can trigger this endpoint to create alerts
      // For example: POST /api/trigger-alert with { "priority": "high", "type": "emergency" }
      
      const body = JSON.parse(event.body || '{}');
      const priority = body.priority || 'medium';
      const type = body.type || 'alert';

      // Create alert by calling the notifications-check endpoint
      const checkEndpoint = process.env.URL || 'http://localhost:8888';
      const createResponse = await fetch(`${checkEndpoint}/.netlify/functions/notifications-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: type,
          priority: priority,
          title: getAlertTitle(type, priority),
          message: getAlertMessage(type, priority),
          shouldRefresh: true,
          refreshDelay: priority === 'high' ? 1000 : 2000
        })
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create notification');
      }

      const result = await createResponse.json();
      
      console.log('Alert created successfully:', result.notification);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Alert triggered successfully',
          notification: result.notification,
          tip: 'The alert should appear in your app within 5 seconds and trigger a page refresh'
        })
      };
    } catch (error) {
      console.error('Error triggering alert:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: error.message 
        })
      };
    }
  }

  // If GET request, show usage information
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/html'
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>MCM Alert Trigger</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .button { background: #007bff; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 5px; cursor: pointer; }
            .button:hover { background: #0056b3; }
            .high { background: #dc3545; }
            .medium { background: #ffc107; color: black; }
            .low { background: #28a745; }
          </style>
        </head>
        <body>
          <h1>🚨 MCM Alert Trigger</h1>
          <p>Use this page to manually trigger alerts and test the auto-refresh notification system.</p>
          
          <h2>Quick Triggers</h2>
          <button class="button high" onclick="triggerAlert('high', 'emergency')">🔴 High Priority Emergency</button>
          <button class="button medium" onclick="triggerAlert('medium', 'alert')">🟡 Medium Priority Alert</button>
          <button class="button low" onclick="triggerAlert('low', 'system')">🟢 Low Priority System Update</button>
          
          <h2>Custom Alert</h2>
          <form onsubmit="triggerCustomAlert(event)">
            <p>
              <label>Priority:</label>
              <select id="priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </p>
            <p>
              <label>Type:</label>
              <select id="type">
                <option value="system">System</option>
                <option value="alert" selected>Alert</option>
                <option value="price_change">Price Change</option>
                <option value="emergency">Emergency</option>
              </select>
            </p>
            <button type="submit" class="button">Trigger Custom Alert</button>
          </form>
          
          <div id="result" style="margin-top: 20px; padding: 10px; border-radius: 5px; display: none;"></div>
          
          <h2>How it works</h2>
          <ol>
            <li>Click any trigger button above</li>
            <li>The alert is created and stored on the server</li>
            <li>Your app polls every 5 seconds and will detect the new alert</li>
            <li>The alert appears as a notification</li>
            <li>After a short delay, the page automatically refreshes</li>
          </ol>
          
          <p><strong>Note:</strong> Make sure your MCM Alerts app is open in another tab to see the notifications and auto-refresh in action!</p>
          
          <script>
            async function triggerAlert(priority, type) {
              const resultDiv = document.getElementById('result');
              resultDiv.style.display = 'block';
              resultDiv.style.background = '#f0f0f0';
              resultDiv.innerHTML = '⏳ Triggering alert...';
              
              try {
                const response = await fetch('/.netlify/functions/trigger-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ priority, type })
                });
                
                const result = await response.json();
                
                if (result.success) {
                  resultDiv.style.background = '#d4edda';
                  resultDiv.innerHTML = \`✅ Alert triggered successfully!<br><small>\${result.tip}</small>\`;
                } else {
                  resultDiv.style.background = '#f8d7da';
                  resultDiv.innerHTML = \`❌ Error: \${result.error}\`;
                }
              } catch (error) {
                resultDiv.style.background = '#f8d7da';
                resultDiv.innerHTML = \`❌ Error: \${error.message}\`;
              }
            }
            
            function triggerCustomAlert(event) {
              event.preventDefault();
              const priority = document.getElementById('priority').value;
              const type = document.getElementById('type').value;
              triggerAlert(priority, type);
            }
          </script>
        </body>
        </html>
      `
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

function getAlertTitle(type, priority) {
  const titles = {
    emergency: {
      high: '🚨 CRITICAL EMERGENCY',
      medium: '⚠️ Emergency Alert',
      low: '🔔 Emergency Notice'
    },
    alert: {
      high: '🔴 HIGH PRIORITY ALERT',
      medium: '🟡 System Alert',
      low: '🟢 General Alert'
    },
    system: {
      high: '⚡ Critical System Issue',
      medium: '🔧 System Update',
      low: '📋 System Notice'
    },
    price_change: {
      high: '📈 Major Price Movement',
      medium: '💰 Price Alert',
      low: '📊 Price Update'
    }
  };
  
  return titles[type]?.[priority] || 'MCM Alert';
}

function getAlertMessage(type, priority) {
  const messages = {
    emergency: {
      high: 'IMMEDIATE ACTION REQUIRED - Critical system failure detected!',
      medium: 'Emergency situation detected. Please review immediately.',
      low: 'Emergency notice posted. Review when possible.'
    },
    alert: {
      high: 'Critical alert requiring immediate attention!',
      medium: 'Important alert notification.',
      low: 'General alert notification for your review.'
    },
    system: {
      high: 'Critical system issue affecting operations!',
      medium: 'System update completed successfully.',
      low: 'Routine system maintenance notification.'
    },
    price_change: {
      high: 'Significant price movement detected - review positions!',
      medium: 'Notable price change in monitored items.',
      low: 'Minor price adjustment recorded.'
    }
  };
  
  return messages[type]?.[priority] || 'New notification from MCM Alerts system.';
}
