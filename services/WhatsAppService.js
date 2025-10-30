// services/WhatsAppService.js (Final Fix)

const { Vonage } = require('@vonage/server-sdk');
const { Auth } = require('@vonage/auth'); // Need this to force Basic Auth

/**
 * Encapsulates the logic for sending messages via the Vonage Messages API.
 */
class WhatsAppService {
    /**
     * @property {Vonage} vonage - The initialized Vonage client instance.
     * @property {string} vonageWhatsAppNumber - The sender ID (without '+').
     */
    constructor() {
        // Initialization is done once in the constructor.
        // We removed the '+' in the previous step, which is good for the payload.
        this.vonageWhatsAppNumber = process.env.VONAGE_WHATSAPP_NUMBER; 

        if (!this.vonageWhatsAppNumber) {
            throw new Error("VONAGE_WHATSAPP_NUMBER is not set. Cannot initialize WhatsAppService.");
        }

        // --- AUTHENTICATION FIX: Force Basic Auth for Sandbox ---
        // 1. Create a Basic Auth object
        const basicAuth = new Auth({
            apiKey: process.env.VONAGE_API_KEY, 
            apiSecret: process.env.VONAGE_API_SECRET
        });
        
        // 2. Initialize Vonage client with the Basic Auth object
        // 3. Override the base URL to point to the Sandbox endpoint
        this.vonage = new Vonage(basicAuth, {
            // 🔥 CRITICAL FIX: Override the API Base URL to point to the Sandbox
            apiHost: 'https://messages-sandbox.nexmo.com', 
            // We still pass the application details for context, but Basic Auth takes precedence.
            applicationId: process.env.VONAGE_APPLICATION_ID,
            privateKey: process.env.VONAGE_PRIVATE_KEY_PATH,
        });
        
        console.log(`[WhatsAppService] Initialized for sender: ${this.vonageWhatsAppNumber} (Mode: SANDBOX)`);
    }

    /**
     * Sends a simple text message to a recipient via WhatsApp.
     * @param {string} to - The recipient's phone number (E.164 format, though Sandbox may be forgiving).
     * @param {string} text - The message content to send.
     * @returns {Promise<object>} The message response object from Vonage.
     */
    async sendTextMessage(to, text) {
        try {

            const cleanedFromNumber = this.vonageWhatsAppNumber.replace('+', '');

            const response = await this.vonage.messages.send({
                to: to,
                from: cleanedFromNumber,
                messageType: 'text',
                text: text,
                channel: 'whatsapp',
            });

            const messageUUID = response.message_uuid;
            console.log(`[WhatsAppService] Message sent. UUID: ${messageUUID}`);
            return response;
        } catch (error) {
            console.error("[WhatsAppService] Error sending message:", error);
            // Throw a custom error to be handled by the controller/orchestration layer
            throw new Error(`Failed to send WhatsApp message: ${error.message}`);
        }
    }
}

module.exports = WhatsAppService;