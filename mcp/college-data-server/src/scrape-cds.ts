import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { YearData, CDSEntry, ScrapedData } from './types.js';
import { parse } from 'node-html-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const OUTPUT_FILE = path.join(STORAGE_DIR, 'cds-data.json');

async function initializeStorage() {
  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // Initialize or load existing data file
  if (!fs.existsSync(OUTPUT_FILE)) {
    const initialData: ScrapedData = {
      colleges: [],
      lastUpdated: new Date().toISOString(),
      totalPages: 4,
      completedPages: []
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')) as ScrapedData;
}

async function extractGoogleDriveUrl(html: string): Promise<string | null> {
  const root = parse(html);
  
  // Try meta refresh tag first
  const metaRefresh = root.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    const content = metaRefresh.getAttribute('content');
    if (content) {
      const match = content.match(/url=([^'"\s]+)/i);
      if (match) return match[1].replace('\\x3d', '=');
    }
  }

  // Try looking for direct Google Drive links
  const links = root.querySelectorAll('a');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href?.includes('drive.google.com')) {
      return href;
    }
  }

  return null;
}

async function getGoogleDriveFileId(url: string): Promise<string | null> {
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
}

async function downloadFile(url: string, college: string, year: string): Promise<string | null> {
  try {
    // First get the HTML page
    const response = await axios.get(url);
    const html = response.data;

    // Extract Google Drive URL
    const driveUrl = await extractGoogleDriveUrl(html);
    if (!driveUrl) {
      console.error(`Could not find Google Drive URL in HTML for ${college} (${year})`);
      return null;
    }

    // Get file ID
    const fileId = await getGoogleDriveFileId(driveUrl);
    if (!fileId) {
      console.error(`Could not extract file ID from URL: ${driveUrl}`);
      return null;
    }

    // Download from Google Drive
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    console.log(`Downloading from Google Drive: ${downloadUrl}`);

    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
      }
    });

    // Check file signature/magic numbers
    const buffer = Buffer.from(fileResponse.data);
    const isPDF = buffer.slice(0, 4).toString('hex') === '25504446'; // %PDF
    const isXLSX = buffer.slice(0, 4).toString('hex') === '504b0304'; // PK..

    const extension = isPDF ? 'pdf' : (isXLSX ? 'xlsx' : 'bin');
    console.log(`Detected file type: ${extension}`);
    
    const filename = `${college.replace(/[^a-zA-Z0-9]/g, '_')}_${year}.${extension}`;
    const filepath = path.join(STORAGE_DIR, filename);
    
    fs.writeFileSync(filepath, buffer);
    
    // Return relative path from storage directory
    return filename;
  } catch (error) {
    console.error(`Error downloading file for ${college} (${year}):`, error);
    return null;
  }
}

async function scrapeCollegeTransitions() {
  const browser = await puppeteer.launch({ 
    headless: true,
    defaultViewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();
  let data = await initializeStorage();
  
  try {
    // Process each page
    for (let pageNum = 1; pageNum <= 4; pageNum++) {
      // Skip if page already completed
      if (data.completedPages.includes(pageNum)) {
        console.log(`Skipping page ${pageNum} - already processed`);
        continue;
      }

      console.log(`Processing page ${pageNum} of 4`);
      
      // Navigate to the page
      if (pageNum === 1) {
        await page.goto('https://www.collegetransitions.com/dataverse/common-data-set-repository', {
          waitUntil: 'networkidle0'
        });
      } else {
        // Click the next button using JavaScript in the page context
        const clicked = await page.evaluate(() => {
          const nextButton = Array.from(document.querySelectorAll('a.footable-page-link'))
            .find(el => el.getAttribute('aria-label') === 'next');
          if (nextButton) {
            (nextButton as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (!clicked) {
          throw new Error(`Could not find next button on page ${pageNum}`);
        }

        // Wait for table to update
        await page.waitForFunction(() => {
          const rows = document.querySelectorAll('table tr');
          return rows.length > 1; // More than just the header row
        });

        // Additional wait to ensure content is loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Wait for table to load
      await page.waitForSelector('table');

      // Extract college data
      const colleges = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr')).slice(1); // Skip header row
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          const years = ['2023-24', '2022-23', '2021-22', '2020-21', '2019-20', '2018-19', '2017-18'];
          
          const collegeData: CDSEntry = {
            unitId: cells[0]?.textContent?.trim() || '',
            name: cells[1]?.textContent?.trim() || '',
            years: Object.fromEntries(
              years.map((year, index) => {
                const link = cells[index + 2]?.querySelector('a');
                const sourceType = link?.href?.toLowerCase().includes('pdf') ? 'pdf' as const : 'spreadsheet' as const;
                return [year, {
                  url: link?.href || null,
                  sourceType,
                  downloaded: false,
                  downloadPath: undefined
                }];
              })
            )
          };
          return collegeData;
        });
      });

      // Process each college
      for (const college of colleges) {
        // Skip if college already exists
        if (data.colleges.some(c => c.unitId === college.unitId)) {
          console.log(`Skipping ${college.name} - already processed`);
          continue;
        }

        console.log(`Processing ${college.name}`);

        // Download available files
        for (const [year, yearData] of Object.entries<YearData>(college.years)) {
          if (yearData.url) {
            console.log(`Downloading ${year} data for ${college.name} from ${yearData.url}`);
            const downloadPath = await downloadFile(yearData.url, college.name, year);
            if (downloadPath) {
              yearData.downloaded = true;
              yearData.downloadPath = downloadPath;
              // Update sourceType based on actual file extension
              yearData.sourceType = downloadPath.endsWith('.pdf') ? 'pdf' : 'spreadsheet';
            }
          }
        }

        // Add to data
        data.colleges.push(college);

        // Save progress after each college
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
      }

      // Mark page as completed
      data.completedPages.push(pageNum);
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }

  return data;
}

// Run the scraper
scrapeCollegeTransitions()
  .then(data => {
    console.log('Scraping completed!');
    console.log(`Processed ${data.colleges.length} colleges`);
    console.log(`Completed pages: ${data.completedPages.join(', ')}`);
  })
  .catch(console.error);
