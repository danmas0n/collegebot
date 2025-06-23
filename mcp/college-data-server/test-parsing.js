import { GeminiService } from './build/services/gemini.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testParsing() {
  try {
    // Check if we have the required environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is required');
      process.exit(1);
    }

    console.log('Initializing Gemini service...');
    const gemini = new GeminiService(apiKey);
    
    // Test with Harvard CDS file
    const filePath = path.join(__dirname, 'storage', 'Harvard_University_2023-24.pdf');
    console.log('Parsing Harvard CDS file:', filePath);
    
    const result = await gemini.parseCDSFile(filePath, 'pdf');
    
    console.log('\n=== PARSING RESULTS ===');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if we got the key data points we're looking for
    console.log('\n=== KEY DATA POINTS ===');
    
    if (result.admissions_profile) {
      console.log('✓ Admissions profile extracted');
      if (result.admissions_profile.demonstrated_interest) {
        console.log(`✓ Demonstrated interest policy: ${result.admissions_profile.demonstrated_interest}`);
      }
      if (result.admissions_profile.acceptance_rate) {
        console.log(`✓ Acceptance rate: ${result.admissions_profile.acceptance_rate}`);
      }
    }
    
    if (result.financial_profile) {
      console.log('✓ Financial profile extracted');
      if (result.financial_profile.cost_of_attendance) {
        console.log(`✓ Cost data available`);
      }
    }
    
    if (result.student_experience) {
      console.log('✓ Student experience data extracted');
    }
    
  } catch (error) {
    console.error('Error testing parsing:', error);
    process.exit(1);
  }
}

testParsing();
