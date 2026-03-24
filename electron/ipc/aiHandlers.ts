import { ipcMain } from 'electron'
import { GoogleGenerativeAI } from '@google/generative-ai'

export function registerAIHandlers() {

  const callGemini = async (systemPrompt: string, userMessage: string, isJson: boolean = false) => {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'PLACEHOLDER_ISI_SENDIRI') {
      throw new Error('GEMINI_API_KEY belum diisi di file .env')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: isJson ? "application/json" : "text/plain",
      }
    })

    return result.response.text()
  }

  // Auto-fill metadata game
  ipcMain.handle('ai:getMetadata', async (_, gameName: string) => {
    try {
      const text = await callGemini(
        `Kamu adalah database game. Balas HANYA dengan JSON valid,
         tanpa markdown, tanpa penjelasan apapun.
         Format wajib: {"developer":"...","genre":"...","year":2024,"description":"..."}
         Genre harus salah satu dari: Action RPG, RPG, Metroidvania, Roguelike,
         Strategy, Adventure, Simulation, Sports, FPS, Fighting, Horror, Puzzle, Other.
         Description maksimal 200 karakter dalam Bahasa Indonesia.`,
        `Berikan metadata untuk game: "${gameName}"`,
        true
      )
      
      let clean = text.replace(/```json|```/g, '').trim()
      const firstBrace = clean.indexOf('{')
      const lastBrace = clean.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1)
      }
      return JSON.parse(clean)
    } catch (err: any) {
      console.error('Error in ai:getMetadata:', err)
      throw err
    }
  })

  // Rekomendasi game
  ipcMain.handle('ai:getRecommendation', async (_, summary: string) => {
    try {
      const lines = summary.split('\n').filter(l => l.trim())
      const randomSeed = lines[Math.floor(Math.random() * lines.length)] || ''
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 
          `Kamu adalah AI asisten Game Launcher bernama ArcVault.
           Berikan rekomendasi game yang singkat, kasual, dan personal dalam 2-3 kalimat Bahasa Indonesia.
           Pertimbangkan genre favorit dan waktu bermain user.
           PENTING: Setiap kali ditanya, rekomendasikan game yang BERBEDA. Jangan selalu merekomendasikan game yang sama.
           Variasikan jawabanmu. Pertimbangkan game yang BELUM LAMA dimainkan atau yang waktu bermainnya masih sedikit.
           
           Fokus kali ini pada game seperti: ${randomSeed}
           
           ---
           
           Library game user:\n${summary}\n\nGame apa yang kamu rekomendasikan sekarang dan mengapa?`
        }] }],
        generationConfig: {
          temperature: 1.2,
          maxOutputTokens: 2048,
          responseMimeType: "text/plain",
        }
      })
      
      return result.response.text()
    } catch (err: any) {
      console.error('Error in ai:getRecommendation:', err)
      throw err
    }
  })
}
