// index.js (Production-Grade Controller Layer)
/**
 * @fileoverview Main entry point for the WhatsApp Auto-Replier Backend.
 * This file handles the webhook contract, coordinates services, and ensures a clean 200 OK response.
 * @author Sohan Sakhare (Architect in Training)
 */

const express = require('express');
const dotenv = require('dotenv');
const WhatsAppService = require('./services/WhatsAppService'); 
const LLMService = require('./services/LLMService');

// --- Configuration and Initialization ---
dotenv.config(); 
const app = express();
const port = process.env.PORT || 3000;

// Initialize Services (This ensures we only create one instance of Vonage client)
const whatsAppService = new WhatsAppService();
const llmService = new LLMService();

// --- Middleware ---
// CRITICAL: We only use route-specific parsers to prevent global body stream consumption.
// The express.text() middleware in the route below populates req.body as a string.
app.use(express.urlencoded({ extended: true }));


// --- Webhook Route: Inbound Messages ---
/**
 * @route POST /vonage/inbound
 * @description Handles incoming WhatsApp messages and status updates from Vonage.
 * NOTE: Currently running in Sandbox mode, relying on the 'express.text' parser for raw body access.
 */
app.post('/vonage/inbound', 
    // Use the raw text parser to put the raw body string onto req.body for manual parsing
    express.text({
        type: '*/*', // Accept all content types
        limit: '5mb'
    }), 
    async (req, res) => { // ⬅️ Using 'async' now for future LLM calls!
    
    console.log("--- Incoming Message Webhook Hit ---");
    
    // 1. Parse the Raw Body (Security check is temporarily disabled for Sandbox PoC)
    let message;
    try {
        message = JSON.parse(req.body);
    } catch (e) {
        console.error("❌ ERROR: Failed to parse raw body as JSON. Sending 400.");
        return res.status(400).send("Invalid JSON payload.");
    }
    
    console.log("✅ Connection Valid. Processing message...");

    // 2. Extract Key Message Data (Based on the discovered Sandbox payload structure)
    const from = message.from; // The user's number (where we need to reply to)
    const messageType = message.message_type;
    const textContent = message.text; 
    
    // 3. Main Business Logic/Orchestration
    if (messageType === 'text' && textContent) {
        console.log(`Received TEXT message from: ${from}. Content: "${textContent}"`);

        try {
            // FUTURE: const llmReply = await llmService.generateReply(textContent);
            // NOW: Send a simple 'hi' for validation
            const llmReply = await llmService.generateReply(textContent);
            
            // ➡️ SERVICE CALL: Send the response back to the user
            await whatsAppService.sendTextMessage(from, llmReply);

            console.log(`➡️ Successfully sent reply: "${llmReply}" to ${from}`);
        } catch (error) {
            // Centralized error handling for the business logic layer
            console.error("🔥 CRITICAL FAILURE in Message Processing:", error.message);
            // Send a safe, internal error response if possible
        }
        
    } else if (messageType) {
        console.log(`Received NON-TEXT message (Type: ${messageType}) from: ${from}`);
    } else if (message.status) {
        console.log(`Received STATUS update: ${message.status} for message ID: ${message.messageId}`);
    } else {
        console.log("Received an unrecognized payload structure.");
    }
    
    // 4. Acknowledge Receipt (MUST RETURN 200 OK IMMEDIATELY)
    res.status(200).send("Message processed successfully.");
});


// --- Server Startup ---
app.listen(port, () => {
    console.log(`🤖 Ari's Auto-Replier Backend running at http://localhost:${port}`);
    console.log(`Note: Running in Sandbox mode for PoC validation.`);
});