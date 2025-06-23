import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    const model = modelName || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.error('Using Gemini model:', model);
    this.model = this.client.getGenerativeModel({ model });
  }

  /**
   * Convert XLSX file to PDF
   * 
   * @param xlsxFilePath Path to XLSX file
   * @returns Path to the generated PDF file
   */
  private async convertXlsxToPdf(xlsxFilePath: string): Promise<string> {
    console.error('Converting XLSX to PDF...');
    
    // Generate output path in the same directory
    const outputPath = xlsxFilePath.replace('.xlsx', '_converted.pdf');
    
    try {
      // Load the workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(xlsxFilePath);
      
      // Create a new PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });
      
      // Pipe the PDF to a file
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);
      
      // Process each worksheet
      let firstSheet = true;
      workbook.eachSheet((worksheet, sheetId) => {
        if (!firstSheet) {
          doc.addPage();
        }
        firstSheet = false;
        
        // Add worksheet name as title
        doc.fontSize(16).text(worksheet.name || `Sheet ${sheetId}`, {
          align: 'center'
        });
        doc.moveDown();
        
        // Convert worksheet data to a readable format
        const rows: string[][] = [];
        const columnWidths: number[] = [];
        
        // Get all rows
        worksheet.eachRow((row, rowNumber) => {
          const rowData: string[] = [];
          row.eachCell((cell, colNumber) => {
            const value = cell.text || cell.value?.toString() || '';
            rowData[colNumber - 1] = value;
            
            // Track column width
            if (!columnWidths[colNumber - 1] || value.length > columnWidths[colNumber - 1]) {
              columnWidths[colNumber - 1] = Math.min(value.length, 40); // Limit width
            }
          });
          rows.push(rowData);
        });
        
        // Render worksheet as a table
        const startX = 50;
        const startY = doc.y;
        const cellPadding = 5;
        const cellHeight = 20;
        const fontSize = 10;
        
        doc.fontSize(fontSize);
        
        // Calculate row positions
        rows.forEach((row, rowIndex) => {
          let y = startY + rowIndex * cellHeight;
          
          // Check if we need a new page
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
          }
          
          let x = startX;
          row.forEach((cell, colIndex) => {
            const colWidth = (columnWidths[colIndex] || 10) * 6; // Approximate character width
            
            // Draw cell
            doc
              .rect(x, y, colWidth, cellHeight)
              .stroke();
            
            // Draw text
            doc
              .text(cell, x + cellPadding, y + cellPadding, {
                width: colWidth - (2 * cellPadding),
                height: cellHeight - (2 * cellPadding)
              });
            
            x += colWidth;
          });
        });
        
        doc.moveDown(2);
      });
      
      // Finalize the PDF
      doc.end();
      
      // Wait for the file to be written
      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          console.error('PDF conversion completed:', outputPath);
          resolve(outputPath);
        });
        writeStream.on('error', reject);
      });
    } catch (error) {
      console.error('Error converting XLSX to PDF:', error);
      throw error;
    }
  }

  async parseCDSFile(filePath: string, format: 'pdf' | 'xlsx'): Promise<any> {
    try {
      let fileToProcess = filePath;
      let fileContent: Buffer;
      
      // If the file is XLSX, convert it to PDF first
      if (format === 'xlsx') {
        try {
          fileToProcess = await this.convertXlsxToPdf(filePath);
          format = 'pdf'; // Update format since we've converted
        } catch (conversionError: unknown) {
          console.error('XLSX conversion failed:', conversionError);
          const errorMessage = conversionError instanceof Error 
            ? conversionError.message 
            : String(conversionError);
          throw new Error(`Failed to convert XLSX to PDF: ${errorMessage}`);
        }
      }
      
      // Read the file content (either original PDF or converted PDF)
      fileContent = fs.readFileSync(fileToProcess);
      const mimeType = 'application/pdf'; // Always use PDF mime type
      
      // Create file data object
      const fileData = {
        inlineData: {
          data: fileContent.toString('base64'),
          mimeType
        }
      };

      console.error('File loaded, size:', fileContent.length);

      // Create comprehensive prompt for parsing
      const prompt = `You are a Common Data Set (CDS) parser. Please analyze this ${format.toUpperCase()} file and extract comprehensive data in the following JSON structure:

{
  "admissions_profile": {
    "acceptance_rate": "percentage of applicants admitted",
    "yield_rate": "percentage of admitted students who enrolled", 
    "total_applicants": "number who applied",
    "total_admitted": "number admitted",
    "total_enrolled": "number enrolled",
    "gpa_ranges": {
      "middle_50_gpa": "25th-75th percentile GPA",
      "average_gpa": "average high school GPA",
      "percent_top_10_percent": "% in top 10% of HS class",
      "percent_top_25_percent": "% in top 25% of HS class"
    },
    "test_scores": {
      "sat_ranges": {
        "composite_25th": "25th percentile SAT composite",
        "composite_75th": "75th percentile SAT composite", 
        "reading_writing_25th": "25th percentile SAT EBRW",
        "reading_writing_75th": "75th percentile SAT EBRW",
        "math_25th": "25th percentile SAT Math",
        "math_75th": "75th percentile SAT Math"
      },
      "act_ranges": {
        "composite_25th": "25th percentile ACT composite",
        "composite_75th": "75th percentile ACT composite"
      },
      "test_policy": "required/optional/test-blind policy",
      "percent_submitting_sat": "% of enrolled students who submitted SAT",
      "percent_submitting_act": "% of enrolled students who submitted ACT"
    },
    "demonstrated_interest": "whether school considers demonstrated interest (campus visits, info sessions, etc.)",
    "early_programs": {
      "early_decision_available": "yes/no",
      "early_action_available": "yes/no", 
      "restrictive_early_action": "yes/no",
      "early_decision_acceptance_rate": "if available",
      "early_action_acceptance_rate": "if available"
    },
    "waitlist_data": {
      "offers_waitlist": "yes/no",
      "waitlist_offered": "number offered place on waitlist",
      "waitlist_accepted": "number accepting waitlist place", 
      "waitlist_admitted": "number admitted from waitlist"
    }
  },
  "financial_profile": {
    "cost_of_attendance": {
      "tuition_fees": "annual tuition and required fees",
      "room_board": "annual room and board costs",
      "total_cost": "total annual cost",
      "books_supplies": "estimated books and supplies cost",
      "other_expenses": "other estimated expenses"
    },
    "financial_aid": {
      "percent_receiving_need_aid": "% receiving need-based aid",
      "percent_receiving_merit_aid": "% receiving non-need aid", 
      "average_need_based_aid": "average need-based aid package",
      "average_merit_aid": "average merit-based aid",
      "percent_need_fully_met": "% whose need was fully met",
      "average_percent_need_met": "average % of need met",
      "average_debt_at_graduation": "average debt for graduates who borrowed"
    },
    "special_aid_programs": "any special financial aid initiatives or policies mentioned"
  },
  "student_experience": {
    "retention_graduation": {
      "first_year_retention_rate": "% of first-year students returning for sophomore year",
      "four_year_graduation_rate": "% graduating in 4 years",
      "six_year_graduation_rate": "% graduating in 6 years"
    },
    "academic_environment": {
      "student_faculty_ratio": "student to faculty ratio",
      "class_sizes": "distribution of class sizes",
      "percent_classes_under_20": "% of classes with fewer than 20 students",
      "percent_classes_over_50": "% of classes with 50+ students"
    },
    "campus_life": {
      "percent_living_on_campus": "% of students living in college housing",
      "percent_out_of_state": "% of students from out of state",
      "percent_international": "% of international students"
    },
    "diversity": {
      "racial_ethnic_breakdown": "breakdown by race/ethnicity",
      "percent_first_generation": "% who are first-generation college students"
    }
  },
  "academic_programs": {
    "popular_majors": "most popular degree areas with percentages",
    "special_programs": "honors programs, study abroad, research opportunities, etc.",
    "academic_requirements": "general education or core curriculum requirements"
  },
  "application_process": {
    "application_deadlines": {
      "regular_decision_deadline": "regular application deadline",
      "early_decision_deadline": "early decision deadline if available",
      "early_action_deadline": "early action deadline if available"
    },
    "notification_dates": {
      "regular_decision_notification": "when regular decisions are released",
      "early_decision_notification": "when early decisions are released",
      "early_action_notification": "when early actions are released"
    },
    "application_requirements": {
      "high_school_units_required": "required high school coursework",
      "high_school_units_recommended": "recommended high school coursework",
      "essay_required": "yes/no",
      "interview_policy": "required/recommended/not considered",
      "letters_of_recommendation": "number required"
    },
    "application_fee": "application fee amount",
    "fee_waiver_available": "yes/no for fee waivers"
  }
}

Extract as much data as possible from the CDS file. If a data point is not available, use null. Focus on accuracy and include specific numbers, percentages, and policies as stated in the document.`;

      // Generate content with the file data
      const result = await this.model.generateContent([
        prompt,
        fileData
      ]);

      const response = await result.response;
      const text = response.text();

      try {
        // Remove markdown code block wrapper if present
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        return JSON.parse(cleanText);
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
