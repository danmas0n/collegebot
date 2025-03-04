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
