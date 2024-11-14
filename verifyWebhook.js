const getAccessToken = require('./getAcessToken');

async function verifyWebhook(headers, webhookPayload) {

    const accessToken = await getAccessToken();

    const body = {
        transmission_id: headers['PAYPAL-TRANSMISSION-ID'],
        transmission_time: headers['PAYPAL-TRANSMISSION-TIME'],
        cert_url: headers['PAYPAL-CERT-URL'],
        auth_algo: headers['PAYPAL-AUTH-ALGO'],
        transmission_sig: headers['PAYPAL-TRANSMISSION-SIG'],
        webhook_id: 'YOUR_WEBHOOK_ID',
        webhook_event: webhookPayload,
    };

    const response = await fetch('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
}

module.exports = verifyWebhook;
