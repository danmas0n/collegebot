import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    const model = modelName || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.error('Using Gemini model:', model);
    this.model = this.client.getGenerativeModel({ model });
  }

  async parseCDSFile(filePath: string, format: 'pdf' | 'xlsx'): Promise<any> {
    try {
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // Create file data object
      const fileData = {
        inlineData: {
          data: fileContent.toString('base64'),
          mimeType
        }
      };

      console.error('File loaded, size:', fileContent.length);

      // Create prompt for parsing
      const prompt = `You are a Common Data Set (CDS) parser. Please analyze this ${format.toUpperCase()} file containing CDS data and extract the following sections:

1. Admissions data (including enrollment numbers, acceptance rates, test scores)
2. Expenses data (including tuition, room & board, fees)
3. Financial aid data (including scholarships, grants, loans)

Please structure the data in a clear JSON format with these main sections. For each data point, include both the question/label and the value.`;

      // Generate content with the file data
      const result = await this.model.generateContent([
        prompt,
        fileData
      ]);

      const response = await result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch (error) {
        console.error('Error parsing Gemini response as JSON:', error);
        return {
          admissions: [],
          expenses: [],
          financialAid: [],
          rawText: text
        };
      }
    } catch (error) {
      console.error('Error in Gemini processing:', error);
      throw error;
    }
  }
}
