/**
 * @fileoverview Service layer for the LLM Agent. Integrates the static Knowledge Base 
 * and the native Google Search tool for dynamic data retrieval.
 * @author Sohan Sakhare (Architect)
 */

const fs = require('fs');
const path = require('path');

// NOTE: We avoid requiring the module directly to prevent the ERR_REQUIRE_ESM error.

class LLMService {
    
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("CRITICAL: LLMService failed: GEMINI_API_KEY is not set. Cannot initialize.");
        }
        
        this.ai = null;
        this.model = 'gemini-2.5-flash'; 
        this.knowledgeBase = this._loadKnowledgeBase();
        
        // Define the System Prompt: Role definition + data instruction
        this.systemPrompt = this._buildSystemPrompt();
        
        // Final Fix: Asynchronously load the ESM dependency
        this.isReady = this._initializeClient();
    }

    /**
     * Loads the comprehensive Athens Day Cruise JSON into memory.
     */
    _loadKnowledgeBase() {
        try {
            // Assuming you save the final JSON file here
            const jsonPath = path.join(__dirname, '..', 'data', 'cruise_knowledge_base.json');
            const data = fs.readFileSync(jsonPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error("CRITICAL: Failed to load knowledge base JSON.", error.message);
            // Must return an empty object if file fails to prevent a crash
            return {};
        }
    }

    /**
     * Builds the System Prompt, injecting the JSON knowledge base for the LLM.
     */
    _buildSystemPrompt() {
        const jsonString = JSON.stringify(this.knowledgeBase, null, 2);

        return `
            You are Ari, the **Official Digital Cruise Consultant** for Athens Day Cruise. 
            Your mission is to provide helpful, enthusiastic, professional, and accurate information to customers.
            
            **I. CORE INSTRUCTIONS:**
            1. **Prioritize JSON:** You MUST strictly use the data provided in the KNOWLEDGE BASE for all questions about cruise details, schedule, prices, and policies. Do not invent information found in the JSON.
            2. **Pricing & Upsell:** When asked about price, always quote the **Standard Price (€119)** and the **VIP Luxury Price (€235)** to upsell the user. Highlight the **included transfers** in the VIP package.
            3. **Booking:** Conclude conversations about price, packages, or reservation with the booking link: https://www.athensdaycruise.gr/booking
            
            **II. TOOL USE (Google Search):**
            * You are equipped with the **Google Search** tool.
            * Use this tool ONLY for dynamic or external information not found in your JSON (e.g., current weather, specific airport transfer logistics, external news). Do not use the tool for prices or schedules already in the JSON.

            ---
            **ATHENS DAY CRUISE KNOWLEDGE BASE (Source of Truth):**
            ${jsonString}
            ---
        `.trim();
    }

    /**
     * Asynchronously loads the Gemini client using dynamic import.
     */
    async _initializeClient() {
        try {
            const geminiModule = await import('@google/genai');
            const GoogleGenAI = geminiModule.GoogleGenAI;
            
            this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            
            console.log(`[LLMService] Initialization complete. Model: ${this.model}. Knowledge base loaded.`);
        } catch (err) {
            console.error(`[LLMService] CRITICAL: Failed dynamic import or initialization.`, err.message);
            throw err;
        }
    }

    /**
     * Generates a conversational reply using the prompt and the Google Search tool.
     */
    async generateReply(userMessage) {
        await this.isReady; 
        
        if (!this.ai) {
             throw new Error("LLMService is not ready. Client initialization failed.");
        }
        
        console.log(`[LLMService] Generating response for: "${userMessage}"`);
        
        // The final configuration uses the prompt, the model, and the native Google Search tool.
        const contents = [
            { role: 'user', parts: [{ text: userMessage }] }
        ];

        try {
            // 🔥 TOOL INTEGRATION: Using the native googleSearch tool as defined by your structure.
            const config = {
                tools: [{ googleSearch: {} }],
                systemInstruction: this.systemPrompt, // Pass the elaborate prompt here
                temperature: 0.6,
            };

            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: contents,
                config: config,
            });

            const reply = response.text.trim();
            console.log(`[LLMService] Reply generated successfully.`);
            return reply;

        } catch (error) {
            console.error(`[LLMService] ERROR during Gemini API call:`, error.message);
            return "Apologies, Sohan! I'm running into a core system error. Could you please rephrase your request or try a technical topic?";
        }
    }
}

module.exports = LLMService;