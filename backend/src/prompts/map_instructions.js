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

4. Required Tool Sequence:
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
