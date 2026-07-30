import { GoogleGenerativeAI } from '@google/generative-ai';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const getApiKeys = () => {
  const keysEnv = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || '';
  return keysEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const getGroqKeys = () => {
  const keysEnv = import.meta.env.VITE_GROQ_API_KEYS || import.meta.env.VITE_GROQ_API_KEY || '';
  return keysEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const getOpenRouterKeys = () => {
  const keysEnv = import.meta.env.VITE_OPENROUTER_API_KEYS || import.meta.env.VITE_OPENROUTER_API_KEY || '';
  return keysEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const getDeepSeekKey = () => {
  return (import.meta.env.VITE_DEEPSEEK_API_KEY || '').trim();
};

const getSiliconFlowKey = () => {
  return (import.meta.env.VITE_SILICONFLOW_API_KEY || '').trim();
};

const getMistralKeys = () => {
  const keysEnv = import.meta.env.VITE_MISTRAL_API_KEYS || import.meta.env.VITE_MISTRAL_API_KEY || '';
  return keysEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const getTogetherKey = () => {
  return (import.meta.env.VITE_TOGETHER_API_KEY || '').trim();
};

const getNvidiaKeys = () => {
  const keysEnv = import.meta.env.VITE_NVIDIA_API_KEYS || import.meta.env.VITE_NVIDIA_API_KEY || '';
  return keysEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const getGithubModelsToken = () => {
  return (import.meta.env.VITE_GITHUB_MODELS_TOKEN || import.meta.env.VITE_GITHUB_TOKEN || '').trim();
};

const getCohereKey = () => {
  return (import.meta.env.VITE_COHERE_API_KEY || '').trim();
};

const getHfToken = () => {
  return (import.meta.env.VITE_HF_TOKEN || '').trim();
};

const getOllamaKey = () => {
  return (import.meta.env.VITE_OLLAMA_API_KEY || '').trim();
};

const getCerebrasKey = () => {
  return (import.meta.env.VITE_CEREBRAS_API_KEY || '').trim();
};

const getSambaNovaKey = () => {
  return (import.meta.env.VITE_SAMBANOVA_API_KEY || '').trim();
};

const getHyperbolicKey = () => {
  return (import.meta.env.VITE_HYPERBOLIC_API_KEY || '').trim();
};

const getFireworksKey = () => {
  return (import.meta.env.VITE_FIREWORKS_API_KEY || '').trim();
};

export interface ExtractedOrder {
  rawId: string;
  orderId?: string; // Optional custom order ID from text
  orderDate: string;
  customerName: string;
  address: string;
  phone: string;
  products: string;
  totalPrice: number;
  shippingFee: number;
  courier: string;
  attachments?: string[];
  dp?: number;       // Down payment amount (0 if none)
  remaining?: number;  // Remaining balance after DP (0 if fully paid)
  dpNote?: string;   // Full DP breakdown e.g. "DP 1: Rp 6.000.000 | Pelunasan: Rp 10.000.000"
  jenis?: string;    // Jewelry type: Anting, Kalung, Pendant, Gelang, Cincin, Bros
  pearlType?: string; // Pearl type: Akoya, Akoya Freshwater, Freshwater, Southsea, Tahitian
  weight?: string;    // Pearl weight e.g. "1.027gram" or "3.9 Gram (estimasi)"
  size?: string;     // Pearl size e.g. "7-7.5" or "8-10"
  color?: string;    // Pearl color e.g. "White", "Deep Gold"
  grade?: string;    // Pearl grade e.g. "AAA", "Good", "A-AA"
  rangka?: string;   // Jewelry setting/frame e.g. "Emas 18K", "Silver"
  gramasiRangka?: string; // Weight of the setting/frame e.g. "0.316"
  shape?: string;    // Pearl shape e.g. "Round", "Baroque", "Tear Drop"
  stone?: string;    // Gemstone type e.g. "Diamond", "Ruby"
  stoneWeight?: string; // Gemstone weight e.g. "2.25ct", "0.335ct"
  qty?: number;      // Quantity of the item
}

/**
 * Infers jewelry type (jenis) and pearl type from a product description string.
 * Used as a fallback when the AI does not extract these fields.
 */
export function inferJenisAndType(products: string): {
  jenis: string;
  pearlType: string;
  size: string;
  color: string;
  grade: string;
  rangka: string;
  shape: string;
  stone: string;
  stoneWeight: string;
} {
  const p = (products || '').toLowerCase();

  // --- Jewelry type (jenis) ---
  let jenis = '';
  if (/\banting\b|earring/i.test(p)) jenis = 'Anting';
  else if (/\bpendant\b|\bliontin\b/i.test(p)) jenis = 'Pendant';
  else if (/\bgelang\b|bracelet/i.test(p)) jenis = 'Gelang';
  else if (/\bcincin\b|\bring\b/i.test(p)) jenis = 'Cincin';
  else if (/\bkalung\b|necklace/i.test(p)) jenis = 'Kalung';
  else if (/\bbros\b|brooch/i.test(p)) jenis = 'Bros';
  else if (/\bset\b/i.test(p)) jenis = 'Set';

  // --- Pearl type (type field) ---
  let pearlType = '';
  const isAkoya     = /akoya/i.test(p);
  const isFreshwater = /freshwater|air tawar/i.test(p);
  const isSeawater   = /seawater|sea water|laut/i.test(p);
  const isSouthsea   = /south\s*sea|southsea|laut selatan|laut/i.test(p);
  const isTahitian   = /tahitian|tahiti/i.test(p);

  if (isAkoya && isFreshwater) pearlType = 'Akoya Freshwater';
  else if (isAkoya && isSeawater) pearlType = 'Akoya Seawater';
  else if (isAkoya) pearlType = 'Akoya';
  else if (isTahitian) pearlType = 'Tahitian';
  else if (isSouthsea) pearlType = 'Southsea';
  else if (isFreshwater) pearlType = 'Freshwater';

  // --- Size (e.g. "7-7,5 mm" → "7-7.5") ---
  let size = '';
  const sizeMatch = p.match(/(\d+[,.]?\d*)\s*[-–]\s*(\d+[,.]?\d*)\s*mm/i)
    || p.match(/size\s*[:\s]*(\d+[,.]?\d*)\s*[-–]\s*(\d+[,.]?\d*)/i);
  if (sizeMatch) size = `${sizeMatch[1].replace(',', '.')}-${sizeMatch[2].replace(',', '.')}`;

  // --- Color ---
  let color = '';
  const colorKeywords = [
    'white', 'cream', 'gold', 'deep gold', 'silver', 'pink',
    'white pink', 'peacock', 'black', 'chocolate', 'purple',
    'putih', 'emas', 'kuning', 'hitam', 'cokelat'
  ];
  for (const kw of colorKeywords) {
    if (p.includes(kw)) { color = kw.charAt(0).toUpperCase() + kw.slice(1); break; }
  }

  // --- Grade ---
  let grade = '';
  const gradeMatch = p.match(/\b(aaa\+?|aa\+?|a\+?|good|fine|commercial|baroque|keshi)\b/i);
  if (gradeMatch) grade = gradeMatch[1].toUpperCase();

  // --- Rangka ---
  let rangka = '';
  if (/emas\s*([0-9]+k)?/i.test(p)) {
    const match = p.match(/emas\s*([0-9]+k)?/i);
    rangka = match ? match[0].toUpperCase().replace('EMAS', 'Emas') : 'Emas';
  } else if (/silver|perak/i.test(p)) {
    rangka = 'Silver';
  } else if (/rhodium/i.test(p)) {
    rangka = 'Rhodium';
  }

  // --- Shape ---
  let shape = '';
  if (/round|bulat/i.test(p)) shape = 'Round';
  else if (/baroque/i.test(p)) shape = 'Baroque';
  else if (/tear\s*drop|teardrop|tetes/i.test(p)) shape = 'Tear Drop';
  else if (/button/i.test(p)) shape = 'Button';
  else if (/oval/i.test(p)) shape = 'Oval';

  // --- Stone & Stone Weight ---
  let stone = '';
  let stoneWeight = '';
  if (/ruby|zamrud|emerald|sapphire|safir|diamond|berlian|zircon/i.test(p)) {
    const stonesMatch = p.match(/(ruby|zamrud|emerald|sapphire|safir|diamond|berlian|zircon)/gi);
    if (stonesMatch) {
      // Capitalize first letter of each matched stone
      stone = Array.from(new Set(stonesMatch.map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))).join(', ');
    }
  }
  // Try to match weights like 2.25ct, 0.335ct, 1 ct
  if (/ct\b/i.test(p)) {
    const weightsMatch = p.match(/(\d+[,.]?\d*)\s*ct/gi);
    if (weightsMatch) {
      stoneWeight = weightsMatch.map(w => w.replace(/\s+/g, '').toLowerCase()).join(', ');
    }
  }

  return { jenis, pearlType, size, color, grade, rangka, shape, stone, stoneWeight };
}

async function queryOpenAiCompatible(
  url: string,
  key: string,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'PearlCRM'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Error'} - ${errorBody}`);
  }
  
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Tidak ada respon konten dari API completions.");
  }
  return content;
}

async function queryOpenAiCompatibleVision(
  url: string,
  key: string,
  model: string,
  prompt: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'PearlCRM'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 8192
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Error'} - ${errorBody}`);
  }
  
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Tidak ada respon konten dari Vision API.");
  }
  return content;
}

export async function parseWhatsAppTextWithAI(textChunk: string): Promise<ExtractedOrder[]> {
  const prompt = `
    Extract customer orders from the following WhatsApp chat export.
    Return ONLY a valid JSON object with an "orders" array containing the following schema:
    {
      "orders": [
        {
          "rawId": "Unique ID for this extraction",
          "orderId": "No Pesanan/Order ID exactly as written (e.g. wa-2026-..., PO-..., etc). If not found, leave empty string",
          "orderDate": "YYYY-MM-DD",
          "customerName": "...",
          "address": "...",
          "phone": "...",
          "products": "Detailed list of products ordered",
          "totalPrice": 16000000,
          "shippingFee": 0,
          "courier": "FREEONGKIR / JNE REG / J&T / etc",
          "dp": 6000000,
          "remaining": 10000000,
          "dpNote": "DP 1: Rp 6.000.000 | Pelunasan: Rp 10.000.000",
          "jenis": "Anting",
          "pearlType": "Akoya Freshwater",
          "weight": "1.027gram",
          "size": "7-7.5",
          "color": "White",
          "grade": "AAA",
          "rangka": "Emas 18K",
          "gramasiRangka": "0.316",
          "shape": "Baroque Tear Drop",
          "stone": "Ruby, Diamond",
          "stoneWeight": "2.25ct, 0.335ct",
          "qty": 1,
          "attachments": ["list of exact filenames mentioned in <terlampir: filename> that belong to this order"]
        }
      ]
    }

    CRITICAL RULE FOR MULTIPLE ITEMS:
    - If a customer orders MULTIPLE distinct items (e.g. a "set anting" AND "3 bros"), you MUST create a SEPARATE object in the "orders" array for EACH item!
    - For each separate item object, duplicate the customerName, address, phone, and attachments.
    - Set the "products" field of each object to just that specific item's description.
    - Extract the specific "jenis", "pearlType", "size", "color", "grade", "rangka", "gramasiRangka", "shape", "stone", "stoneWeight", and "qty" (quantity of this specific item) for THAT specific item.
    - IMPORTANT TO PREVENT DOUBLE-COUNTING: Only the FIRST item object for a customer should contain the "totalPrice", "shippingFee", "dp", and "remaining". Set these fields to 0 for the 2nd, 3rd, etc. items of the same customer!


    IMPORTANT RULES FOR EXTRACTING PRICES:
    - "totalPrice" MUST be the final total from the "*Total Bayar*" or "Total Bayar" section ONLY.
      Do NOT use the DP/uang muka/down payment amount as totalPrice.
    - If the order has a down payment (DP), set:
      * "dp" = the DP amount (e.g. 6000000)
      * "remaining" = the remaining balance / pelunasan amount (e.g. 10000000)
      * "dpNote" = a concise summary of the payment plan, e.g. "DP 1: Rp 6.000.000 | Pelunasan: Rp 10.000.000"
    - If there is NO down payment, set dp=0, remaining=0, dpNote="".
    - "shippingFee" = the shipping cost (ongkir). If "Freeongkir" or 0, set to 0.

    RULES FOR PRODUCT DETAIL FIELDS:
    - "jenis" = the type of jewelry from product description:
      * Anting / Earring → "Anting"
      * Kalung / Necklace → "Kalung"
      * Pendant / Liontin → "Pendant"
      * Gelang / Bracelet → "Gelang"
      * Cincin / Ring → "Cincin"
      * Bros / Brooch → "Bros"
      * Set → "Set"
    - "pearlType" = the pearl origin/type:
      * Akoya + Freshwater → "Akoya Freshwater"
      * Akoya + Seawater/Laut → "Akoya Seawater"
      * Akoya alone → "Akoya"
      * South Sea / Southsea / Laut Selatan → "Southsea"
      * Tahitian / Tahiti → "Tahitian"
      * Freshwater / Air Tawar → "Freshwater"
    - "weight" = pearl weight e.g. "1.027gram" or "3.9 Gram (estimasi)", or "" if not mentioned
    - "size" = pearl size in mm, format "X-Y" e.g. "7-7.5", "8-10", or "" if not mentioned
    - "color" = pearl color e.g. "White", "Deep Gold", "White Pink", "" if not mentioned
    - "grade" = pearl quality grade e.g. "AAA", "AA", "Good", "A-AA", "" if not mentioned
    - "rangka" = the setting/frame material e.g. "Emas 18K", "Silver", "" if not mentioned
    - "gramasiRangka" = the weight of the setting/frame in grams, just the number e.g. "0.316", "" if not mentioned
    - If any of jenis/pearlType/size/color/grade/rangka/gramasiRangka is not found in the text, return "" for that field.

    If no orders are found, return {"orders": []}.
    Ensure the JSON is strictly valid, with no markdown codeblocks, just the JSON string.
    
    Text:
    ${textChunk}
  `;

  // Build the chain of all available key attempts
  const attempts: { name: string; run: () => Promise<string> }[] = [];

  // ==========================================
  // TIER 1: THE SPEED DEMONS (Specialized AI Chips)
  // Groq diutamakan karena Gemini free tier sering habis kuota.
  // ==========================================
  getGroqKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Groq (Llama 3.3 70B - Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          key,
          'llama-3.3-70b-versatile',
          prompt
        );
      }
    });
  });

  const cerebrasKey = getCerebrasKey();
  if (cerebrasKey) {
    attempts.push({
      name: 'Cerebras (Llama 3.1 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.cerebras.ai/v1/chat/completions',
          cerebrasKey,
          'llama3.1-70b',
          prompt
        );
      }
    });
  }

  const sambaKey = getSambaNovaKey();
  if (sambaKey) {
    attempts.push({
      name: 'SambaNova (Llama 3.1 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.sambanova.ai/v1/chat/completions',
          sambaKey,
          'Meta-Llama-3.1-70B-Instruct',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 3: ENTERPRISE GRADE (High Reliability Llama)
  // Extremely stable infrastructure.
  // ==========================================
  getNvidiaKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Nvidia (Llama 3.3 70B - Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatible(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          key,
          'meta/llama-3.3-70b-instruct',
          prompt
        );
      }
    });
  });

  const ghToken = getGithubModelsToken();
  if (ghToken) {
    attempts.push({
      name: 'GitHub Models Azure (Llama 3.3 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://models.inference.ai.azure.com/chat/completions',
          ghToken,
          'Meta-Llama-3.3-70B-Instruct',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 4: HIGH INTELLIGENCE ALTERNATIVES
  // ==========================================
  const dsKey = getDeepSeekKey();
  if (dsKey) {
    attempts.push({
      name: 'DeepSeek (V3 Chat)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.deepseek.com/chat/completions',
          dsKey,
          'deepseek-chat',
          prompt
        );
      }
    });
  }

  getMistralKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Mistral Large (Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.mistral.ai/v1/chat/completions',
          key,
          'mistral-large-latest',
          prompt
        );
      }
    });
  });

  const cohereKey = getCohereKey();
  if (cohereKey) {
    attempts.push({
      name: 'Cohere (Command R+)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.cohere.com/v1/chat/completions',
          cohereKey,
          'command-r-plus',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 5: ROBUST GPU CLOUD INFERENCE
  // ==========================================
  const hyperbolicKey = getHyperbolicKey();
  if (hyperbolicKey) {
    attempts.push({
      name: 'Hyperbolic (Llama 3.1 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.hyperbolic.xyz/v1/chat/completions',
          hyperbolicKey,
          'meta-llama/Meta-Llama-3.1-70B-Instruct',
          prompt
        );
      }
    });
  }

  const fireworksKey = getFireworksKey();
  if (fireworksKey) {
    attempts.push({
      name: 'Fireworks (Llama 3.1 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.fireworks.ai/inference/v1/chat/completions',
          fireworksKey,
          'accounts/fireworks/models/llama-v3p1-70b-instruct',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 6: AGGREGATORS & OTHER FALLBACKS
  // ==========================================
  getOpenRouterKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `OpenRouter (Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          key,
          'meta-llama/llama-3.3-70b-instruct',
          prompt
        );
      }
    });
  });

  const sfKey = getSiliconFlowKey();
  if (sfKey) {
    attempts.push({
      name: 'SiliconFlow (Qwen 2.5 72B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.siliconflow.cn/v1/chat/completions',
          sfKey,
          'Qwen/Qwen2.5-72B-Instruct',
          prompt
        );
      }
    });
  }

  const tgKey = getTogetherKey();
  if (tgKey) {
    attempts.push({
      name: 'Together AI (Llama 3.3 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api.together.xyz/v1/chat/completions',
          tgKey,
          'meta-llama/Llama-3.3-70B-Instruct-Reference',
          prompt
        );
      }
    });
  }

  const hfToken = getHfToken();
  if (hfToken) {
    attempts.push({
      name: 'HuggingFace (Llama 3 70B)',
      run: async () => {
        return await queryOpenAiCompatible(
          'https://api-inference.huggingface.co/v1/chat/completions',
          hfToken,
          'meta-llama/Meta-Llama-3-70B-Instruct',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 7: LAST RESORT
  // ==========================================
  const ollamaKey = getOllamaKey();
  if (ollamaKey) {
    attempts.push({
      name: 'Ollama (Remote)',
      run: async () => {
        return await queryOpenAiCompatible(
          'http://localhost:11434/v1/chat/completions',
          ollamaKey,
          'llama3',
          prompt
        );
      }
    });
  }

  // ==========================================
  // TIER 7 (LAST RESORT): Google Gemini
  // Dipindah ke bawah karena free tier sering habis kuota harian.
  // Akan aktif kembali otomatis keesokan harinya.
  // ==========================================
  getApiKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Gemini 2.5 Flash (Key #${i + 1})`,
      run: async () => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash",
          generationConfig: { maxOutputTokens: 8192 }
        });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      }
    });
    attempts.push({
      name: `Gemini 1.5 Flash (Key #${i + 1})`,
      run: async () => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          generationConfig: { maxOutputTokens: 8192 }
        });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      }
    });
  });

  if (attempts.length === 0) {
    throw new Error("Tidak ada API Key yang terkonfigurasi di file .env");
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      console.log(`Mencoba pemrosesan teks dengan: ${attempt.name}`);
      const text = await attempt.run();
      
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');

      let start = -1;
      let end = -1;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = lastBrace;
      } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
      }

      if (start !== -1 && end !== -1 && end > start) {
        let jsonContent = text.substring(start, end + 1);
        // Fix trailing commas (common LLM mistake)
        jsonContent = jsonContent.replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(jsonContent);
        const orders = Array.isArray(parsed) ? parsed : (parsed.orders || []);
        console.log(`Berhasil mengekstrak ${orders.length} order menggunakan ${attempt.name}`);
        return orders;
      }
      throw new Error("Respon tidak memuat format JSON yang valid.");
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.error(`Gagal menggunakan ${attempt.name}:`, errMsg);
      errors.push(`${attempt.name}: ${errMsg}`);
    }
  }

  throw new Error(`Semua provider AI gagal memproses chat:\n\n${errors.join('\n')}`);
}

export async function scanImageWithVisionAI(file: File): Promise<{ customerName: string | null; senderName: string | null; amount: number | null }> {
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
  
  const prompt = `
    Analyze this image (which is either a shipping label or a bank transfer receipt).
    Extract the following information and return ONLY a valid JSON object:
    {
      "customerName": "Name of the receiver/buyer if visible, otherwise null",
      "senderName": "Name of the sender/account holder if visible, otherwise null",
      "amount": 150000 // The total transfer amount as a number, if visible, otherwise null
    }
    Make sure to return only the JSON string.
  `;

  const attempts: { name: string; run: () => Promise<string> }[] = [];

  // 1. Gemini
  getApiKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Gemini 2.5 Flash Vision (Key #${i + 1})`,
      run: async () => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash",
          generationConfig: { maxOutputTokens: 8192 }
        });
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
        return result.response.text().trim();
      }
    });
    attempts.push({
      name: `Gemini 2.0 Flash Vision (Key #${i + 1})`,
      run: async () => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          generationConfig: { maxOutputTokens: 8192 }
        });
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
        return result.response.text().trim();
      }
    });
  });

  // 2. Groq (Llama 3.2 11B Vision)
  getGroqKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `Groq Vision (Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatibleVision(
          'https://api.groq.com/openai/v1/chat/completions',
          key,
          'llama-3.2-11b-vision-preview',
          prompt,
          base64Data,
          file.type
        );
      }
    });
  });

  // 3. OpenRouter (Llama 3.2 11B Vision Instruct)
  getOpenRouterKeys().forEach((key: string, i: number) => {
    attempts.push({
      name: `OpenRouter Vision (Key #${i + 1})`,
      run: async () => {
        return await queryOpenAiCompatibleVision(
          'https://openrouter.ai/api/v1/chat/completions',
          key,
          'meta-llama/llama-3.2-11b-vision-instruct',
          prompt,
          base64Data,
          file.type
        );
      }
    });
  });

  // 4. Together AI (Llama 3.2 11B Vision Instruct)
  const tgKey = getTogetherKey();
  if (tgKey) {
    attempts.push({
      name: 'Together AI Vision',
      run: async () => {
        return await queryOpenAiCompatibleVision(
          'https://api.together.xyz/v1/chat/completions',
          tgKey,
          'meta-llama/Llama-3.2-11B-Vision-Instruct',
          prompt,
          base64Data,
          file.type
        );
      }
    });
  }

  // 5. SiliconFlow (Qwen2-VL-7B)
  const sfKey = getSiliconFlowKey();
  if (sfKey) {
    attempts.push({
      name: 'SiliconFlow Vision',
      run: async () => {
        return await queryOpenAiCompatibleVision(
          'https://api.siliconflow.cn/v1/chat/completions',
          sfKey,
          'Qwen/Qwen2-VL-7B-Instruct',
          prompt,
          base64Data,
          file.type
        );
      }
    });
  }

  if (attempts.length === 0) {
    throw new Error("Tidak ada API Key Vision yang terkonfigurasi di file .env");
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      console.log(`Mencoba scan gambar dengan: ${attempt.name}`);
      const text = await attempt.run();
      
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonContent = text.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonContent);
        console.log(`Berhasil men-scan gambar dengan ${attempt.name}`);
        return {
          customerName: parsed.customerName || null,
          senderName: parsed.senderName || null,
          amount: parsed.amount ? Number(parsed.amount) : null
        };
      }
      throw new Error("Respon tidak memuat format JSON yang valid.");
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.error(`Gagal scan gambar menggunakan ${attempt.name}:`, errMsg);
      errors.push(`${attempt.name}: ${errMsg}`);
    }
  }

  throw new Error(`Semua provider AI Vision gagal memproses gambar:\n\n${errors.join('\n')}`);
}

export async function uploadImageToStorage(file: File, folder: string = 'whatsapp_attachments'): Promise<string> {
  if (!storage) throw new Error("Firebase Storage belum siap.");
  const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}
