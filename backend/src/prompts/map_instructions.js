// Instructions for Claude on adding locations to the map

export const mapInstructions = `
Process:

1. Identify Locations:
   • Extract ALL colleges and scholarships from conversation
   • Include good fits, poor fits, and mentioned options
   • Create separate pins for scholarships (even if college-associated)
   • Track source chat IDs for traceability

2. Check Current Map:
   • Review existing pins to avoid duplicates

3. For Each Location:
   a) Extract: Name, address, type, website, reference links, fit assessment
   b) Geocode: Get coordinates using geocode tool
   c) Create Pin: Use create_map_location tool with full metadata
   d) Assign Tier (colleges only): Use update_map_location_tier after creating pin

4. Tier Assignment & Merit Aid Assessment (CRITICAL for Colleges):
   After creating each college pin, assign BOTH a tier AND merit aid likelihood:
   
   TIER DEFINITIONS:
   • REACH: Student stats below college's 25th percentile OR acceptance rate <15%
   • TARGET: Student stats within college's 25th-75th percentile range
   • SAFETY: Student stats above college's 75th percentile AND acceptance rate >40%
   • LIKELY: Student stats well above college's range AND acceptance rate >60%
   
   MERIT AID LIKELIHOOD (assess simultaneously with tier):
   • HIGH: Student stats in top 25% for this school AND school offers merit scholarships
     - Example: Student SAT 1550 vs school's 75th percentile 1450
     - School has known merit programs or high % receiving merit aid
   • MEDIUM: Student stats above median AND some merit aid available
     - Example: Student SAT 1500 vs school median 1400
     - School offers selective merit scholarships
   • LOW: Student stats near median OR limited merit aid offered
     - Example: Student SAT 1400 vs school median 1380
     - School has minimal merit aid programs
   • NONE: Reach school (student below 25th percentile) OR school doesn't offer merit aid
     - Most highly selective schools (Ivies, etc.) offer need-based aid only
     - Student stats don't qualify for merit consideration
   
   Use update_map_location_tier tool with ALL parameters:
   - locationId: The ID of the pin you just created
   - tier: One of the tier categories above
   - reasoning: Detailed comparison (e.g., "Student GPA 3.95 vs College median 3.7 (25th: 3.5, 75th: 3.9); Student SAT 1550 vs College range 1400-1520; Acceptance rate 18%. Classification: TARGET because student is in middle 50% for both metrics.")
   - meritAidLikelihood: One of: 'high', 'medium', 'low', 'none'
   - meritAidReasoning: Explanation (e.g., "High likelihood: Student SAT 1550 is in top 10% for this school (75th percentile: 1450). School offers competitive Presidential Scholarships ($15k-$25k/year) to attract top students. As a TARGET school, they actively use merit aid to compete for students of this caliber.")
   
   IMPORTANT: 
   - Get CDS data first to make accurate assessments
   - Consider tier when assessing merit aid (reach schools rarely give merit, target/safety schools often do)
   - Look for merit scholarship data in CDS Section H
   - Geographic diversity and demographic factors can increase merit aid likelihood

5. Required Tool Sequence:
   Step 1: <tool><name>geocode</name><parameters>{"address": "Full address", "name": "Location name"}</parameters></tool>
   Step 2: <tool><name>create_map_location</name><parameters>{"studentId": "ID", "location": {...}}</parameters></tool>

5. Location Data Structure:
   {
     "id": "[type]-[name-slug]-[timestamp]",
     "type": "college" | "scholarship",
     "name": "Location name",
     "latitude": number,
     "longitude": number,
     "sourceChats": ["chatId1"],
     "metadata": {
       "website": "URL",
       "description": "Brief description + fit issues",
       "address": "Full address",
       "matchesPreferences": {
         "region": boolean,
         "state": boolean,
         "distance": boolean,
         "setting": boolean
       },
       "fitIssues": {
         "financial": boolean,
         "academic": boolean,
         "location": boolean,
         "other": "description"
       },
       "referenceLinks": [
         {
           "url": "URL",
           "title": "Link title",
           "category": "admissions|financial|academic|application",
           "source": "official|unofficial",
           "target": "_blank"
         }
       ],
       // For scholarships only:
       "amount": number,
       "deadline": "YYYY-MM-DD",
       "applicationUrl": "URL"
     }
   }

Guidelines:
- Process one location at a time
- Wait for geocode results before creating pin
- Include fit issues clearly in descriptions
- Mark ALL links to open in new tabs
- Use official addresses when possible
- Don't fabricate tool responses

Output summary in <answer> tags using HTML format.
`;
