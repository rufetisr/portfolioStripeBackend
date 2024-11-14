require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer')
const fs = require('fs')
const path = require('path')
const app = express();
const cors = require('cors');

// logger 
const logger = require('./logger')
const requestLogger = require('./loggerMiddleware')

// helper methods
// const getAccessToken = require('./getAcessToken');
const verifyWebhook = require('./verifyWebhook');


// stripe
// const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY
// const stripe = require('stripe')(STRIPE_PRIVATE_KEY);


app.use(cors({
    origin: `${process.env.CLIENT_DOMAIN}`
}));

app.use(['/publish', '/checkout-session'], requestLogger)

app.use((req, res, next) => {

    const referer = req.get('Referer');

    if (req.path == '/webhook') {
        // Allow all requests to the webhook
        return next();
    }

    if (referer?.startsWith(`${process.env.CLIENT_DOMAIN}`)) {
        return next();
    } else {
        return res.status(403).send('<b>Forbidden!</b>');
    }
});



const appPass = process.env.EMAIL_APP_KEY;

const transporter = nodemailer.createTransport(
    {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,

        auth: {
            user: 'rufet.isr123@gmail.com',
            pass: appPass,
        }
    }
)

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})


app.post('/checkout-session', async (req, res) => {
    try {

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Portfolio Website Product',
                            description: `This is a personal portfolio showcasing work and projects of the owner. It serves as a platform to display your projects, skills, and experience to potential clients or employers in the specific field. 
                            It includes a clean, responsive mobile menu and sticky navigation for effortless browsing on any device.
                            Built-in downloadable QR code provides instant access to your site, while a contact form integrated with EmailJS ensures easy communication with your audience. 
                            After payment you will get email with source code link.`,
                            images: ['https://fiela-template-preview.netlify.app/images/dark-mode.png'],
                        },
                        unit_amount: 999, // e.g., $16.99
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',

            success_url: 'http://127.0.0.1:5500/client/success.html',
            cancel_url: `http://localhost:5500/client/cancel.html`,
        });

        res.json({ url: session.url }); // it is gonna return url from our session

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
})

// to handle events after payment for stripe
// app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
//     const sig = req.headers['stripe-signature'];
//     console.log('webhook');

//     let event;

//     try {
//         event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//     } catch (err) {
//         logger.error(`Webhook signature verification failed. ${err.message}`)
//         // console.error('Webhook signature verification failed.');
//         return res.sendStatus(400);
//     }

//     //event.type == 'charge.captured' || event.type == 'payment_intent.succeeded' || 
//     // Handle the event
//     if (event.type === 'checkout.session.completed') {
//         const session = event.data.object;
//         const customerEmail = session?.customer_details?.email;
//         // console.log('Payment success');
//         logger.info(`Payment success from: ${customerEmail}`)


//         if (customerEmail) {

//             transporter.sendMail({
//                 to: `${customerEmail}`,
//                 subject: 'Your project zip file',
//                 html: '',
//                 text: `
//                 Project link: https://drive.google.com/file/d/1ROa-zR7fJaFBOjIPo2NqWYZmeK2nlESJ/view?usp=drive_link
//                 If file doesn't open, click Request access, you will get project file as soon as possible.
//                 `
//             }, async (err, info) => {
//                 if (err) {
//                     logger.error(`Error sending email: ${err.message}`)
//                     return res.status(500).send(err.message);
//                 }
//                 else {
//                     logger.info('Success sending email')
//                     return res.status(200).send('Success email sending');
//                 }
//             })
//             return;
//             /// -------//////
//         }
//     }

//     // Respond to Stripe
//     res.json({ received: true });
// });


// to handle events after payment for paypal webhook
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    // Replace 'YOUR_WEBHOOK_ID' and 'YOUR_PAYPAL_CLIENT_SECRET' with your own values
    const headers = req.headers;
    const webhookPayload = req.body;

    // Verify webhook data


    try {
        const isValid = verifyWebhook(headers, webhookPayload);

        if (isValid) {
            logger.info('Webhook verified and processed:', webhookPayload);

            // Process your event here based on the webhook data
            // For example: if (webhookPayload.event_type === 'PAYMENT.AUTHORIZATION.CREATED') {...}

            // res.status(200).send('Webhook verified and processed');

            if (req.body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
                const paymentInfo = req?.body?.resource;
                const customerEmail = paymentInfo?.payer?.email_address;
                logger.info(`Payment success from: ${customerEmail}`)
                // Process payment or send confirmation email to customerEmail

                if (customerEmail) {

                    transporter.sendMail({
                        to: `${customerEmail}`,
                        subject: 'Your project file',
                        html: '',
                        text: `
                        Project link: https://drive.google.com/file/d/1ROa-zR7fJaFBOjIPo2NqWYZmeK2nlESJ/view?usp=drive_link                
                        `
                    }, async (err, info) => {
                        if (err) {
                            logger.error(`Error sending email: ${err.message}`)
                            return res.status(500).send(err.message);
                        }
                        else {
                            logger.info('Success sending email')
                            return res.status(200).send('Success email sending');
                        }
                    })
                    return;
                    /// -------//////
                }

                res.sendStatus(200); // Respond to PayPal to acknowledge receipt
            } else {
                res.sendStatus(400); // Bad request if verification fails
            }
        }
        else {
            console.warn('Invalid webhook signature');
            res.status(400).send('Invalid signature');
        }
    } catch (error) {
        logger.error(`Error verifying webhook: ${error.message}`)
        return res.sendStatus(400);
    }




});


// for stripe public client key
// app.get('/publish', (req, res) => {
//     // console.log('Successfully sended');
//     logger.info('Successfully sended pKey');
//     return res.status(200).json({ STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY });
// });