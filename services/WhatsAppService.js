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

    /**
     * 
     * @param {*} to 
     * @param {*} templateName 
     * @param {*} templateLanguage 
     * @param {*} bodyParameters 
     * @param {*} mediaUrl 
     * @returns 
     * Sends a WhatsApp template message with dynamic media header and body parameters.
     * // index.js (Controller Orchestration Example)

    // Assuming the LLM Service decides to use the first image URL from the JSON
    const bannerUrl = 'https://www.athensdaycruise.gr/wp-content/uploads/2024/12/Hydra_history-scaled.jpg';
    const userName = 'Sohan'; // Extracted from user data/profile

    // The LLM decides the text variables (Price and Package Name)
    const parameters = [
        { value: userName },                       // {{1}} -> Sohan
        { value: 'Standard Cruise' },              // {{2}} -> Standard Cruise
        { value: '€119.00' }                       // {{3}} -> €119.00
    ];

    await whatsAppService.sendTemplateMessage(
        from, 
        'athens_cruise_intro', // The pre-approved template name
        'en', 
        parameters, 
        bannerUrl // The media URL for the header
    );
     */
    async sendTemplateMessage(to, templateName, templateLanguage, bodyParameters, mediaUrl = null) {

        // Structure the components array
        const components = [];

        // 1. Handle dynamic media header (e.g., your banner/image)
        if (mediaUrl) {
            components.push({
                type: 'header',
                parameters: [{
                    type: 'image', // Could be 'video' or 'document'
                    image: {
                        url: mediaUrl // The public URL of your banner image
                    }
                }]
            });
        }

        // 2. Handle body text variables
        if (bodyParameters && bodyParameters.length > 0) {
            components.push({
                type: 'body',
                parameters: bodyParameters.map(p => ({
                    type: 'text',
                    text: p.value
                }))
            });
        }

        // 3. (Optional) Handle dynamic buttons, footers, etc. here

        try {
            const response = await this.vonage.messages.send({
                to: to,
                from: this.vonageWhatsAppNumber,
                channel: 'whatsapp',
                messageType: 'template',

                template: {
                    name: templateName,
                    language: { code: templateLanguage },
                    components: components // ⬅️ The key change is using this dynamic array
                }
            });

            const messageUUID = response.message_uuid;
            console.log(`[WhatsAppService] Template with media sent. UUID: ${messageUUID}`);
            return response;
        } catch (error) {
            console.error("[WhatsAppService] Error sending template:", error);
            throw new Error(`Failed to send rich media template: ${error.message}`);
        }
    }
}

module.exports = WhatsAppService;