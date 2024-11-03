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

// stripe
const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY
const stripe = require('stripe')(STRIPE_PRIVATE_KEY);

// body-parser
// const bodyParser = require('body-parser')


// const { createProxyMiddleware } = require('http-proxy-middleware')


app.use(express.json())
// app.use(express.urlencoded({ extended: true }))

// console.log(process.env.CLIENT_DOMAIN);

// Use body-parser middleware to parse incoming JSON requests
// Middleware to capture raw body for the webhook
// app.use(express.json({
//     verify: (req, res, buf) => {
//         req.rawBody = buf // Capture the raw body buffer
//     }
// }));

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


// const proxyMiddleware = createProxyMiddleware({
//     target: 'http://localhost:3000', // Your backend server URL
//     changeOrigin: true,
//     pathRewrite: { '^/api': '' } // Remove `/api` prefix when forwarding to backend
// })
// Proxy setup
// app.use('/api', (req, res, next) => {
//     console.log(`Proxying request: ${req.path}`);
//     next();
// });

// app.use('/api', (req, res, next) => {
//     console.log(`Proxying request: ${req.path}`);
//     next();
// }
//     , createProxyMiddleware({
//         target: 'http://localhost:3000', // Your backend server URL
//         changeOrigin: true,
//         pathRewrite: { '^/api': '/' }, // Remove `/api` prefix when forwarding to backend,

//     }))

const appPass = process.env.EMAIL_APP_KEY;
// console.log(appPass);

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


// const storeItems = new Map([
//     [1, { priceInCents: 100, name: 'Learn React Course' }],
//     [2, { priceInCents: 200, name: 'Learn Node Js' }],
// ])

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
        // const resp = await session;
        // console.log(resp);


        res.json({ url: session.url }); // it is gonna return url from our session

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
})

// to handle events after payment
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    console.log('webhook');

    let event;

    // Logging the received signature and raw body for debugging
    // console.log('Received signature:', sig);
    // console.log('Raw body:', req.rawBody.toString());

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        logger.error(`Webhook signature verification failed. ${err.message}`)
        // console.error('Webhook signature verification failed.');
        return res.sendStatus(400);
    }
    // console.log(event);
    //event.type == 'charge.captured' || event.type == 'payment_intent.succeeded' || 
    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session?.customer_details?.email;
        // console.log('Payment success');
        logger.info(`Payment success from: ${customerEmail}`)

        // You can now store or use the customer's email
        // console.log('Customer Email:', customerEmail);

        if (customerEmail) {

            // const zipFilePath = path.join('./', 'MainFiles.zip'); // Replace with your ZIP file's path
            transporter.sendMail({
                to: `${customerEmail}`,
                subject: 'Your project zip file',
                html: '',
                text: `
                Project link: https://drive.google.com/file/d/1ROa-zR7fJaFBOjIPo2NqWYZmeK2nlESJ/view?usp=drive_link
                If file doesn't open, click Request access, you will get project file as soon as possible.
                `
                // attachments: [
                //     {
                //         filename: 'YourProject.7z',
                //         path: './MainFiles.7z',
                //         contentType: 'application/zip'
                //     }

                // ]
                // text: 'Please find the attached ZIP file.'
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
    }
    // console.log('after payment');

    // Respond to Stripe
    res.json({ received: true });
});




app.get('/publish', (req, res) => {
    // console.log('Successfully sended');
    logger.info('Successfully sended pKey');
    res.json({ STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY });
});