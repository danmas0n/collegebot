// Instructions for Claude on adding locations to the map

export const mapInstructions = `
Instructions:

1. Analyze the conversation history to identify ALL colleges and scholarships that should be added to the student's map, even if they aren't preferred choices. Include:
   - Schools and scholarships that are good fits
   - Schools and scholarships the student asked about, even if they aren't good fits
   - Options mentioned in recommendations discussions, even if not highlighted as top choices

2. Check the current map state to avoid duplicating existing pins.

3. For each location that needs to be added, follow this process:

   a) Extract Essential Information
      - College or scholarship name
      - Physical address
      - Type (college or scholarship)
      - Website URL
      - Any reference links from the conversation
      - Note any fit issues (financial, academic, location, etc.)
      - For scholarships, capture amount and deadline information

   b) Organize Reference Links
      - Look for links collected during recommendations
      - Categorize by purpose (admissions, financial, academic, etc.)
      - Note whether sources are official or unofficial

   c) Prepare Location Data
      - Format the address properly for geocoding
      - Prepare a brief description of why this location is relevant
      - If it's not a good fit, clearly note the specific problems (e.g., "Not a financial fit: tuition exceeds budget by $10k/year")
      - Note how it matches student preferences (region, state, setting)
      - For scholarships, highlight amount and application details in the description

4. IMPORTANT: You MUST use the actual tools by calling them in the exact format below. DO NOT fabricate tool responses or pretend to call tools. Use the following tools in sequence for each location:

   a) First, geocode the address:
      <tool>
        <name>geocode</name>
        <parameters>
          {"address": "College or organization address", "name": "Location name"}
        </parameters>
      </tool>

   b) Create the map pin with the geocoded coordinates:
      <tool>
        <name>create_map_location</name>
        <parameters>
          {
            "studentId": "[Current student ID]",
            "location": {
              "id": "[type]-[name-slug]-[timestamp]",
              "type": "college" | "scholarship",
              "name": "Location name",
              "latitude": number,
              "longitude": number,
              "metadata": {
                "website": "URL", // Will open in new tab (_blank)
                "description": "Brief description including any fit issues",
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
                  "other": string
                },
                "referenceLinks": [
                  {
                    "url": "URL",
                    "title": "Link title",
                    "category": "admissions" | "financial" | "academic" | "campus" | "career" | "research" | "application" | "student-life" | "social",
                    "source": "official" | "semi-official" | "unofficial",
                    "target": "_blank"
                  }
                ],
                // For colleges
                "reason": "Brief reason for inclusion",
                // For scholarships
                "amount": number,
                "deadline": "YYYY-MM-DD",
                "applicationUrl": "URL" // Will open in new tab (_blank)
              }
            }
          }
        </parameters>
      </tool>

5. CRITICAL: Ensure that you actually call all the necessary functions -- first geocode, then create_map_location -- and that you wait 
for the geocode results before creating the map location. Do not skip or fabricate these steps, or the map pins will not actually be created.

6. Throughout your analysis, wrap your thought process in <analysis> tags to show your reasoning - keep these concise and focused.

7. When you're ready to provide a summary of the locations you've added, use <answer> tags - format this in HTML.

Special Cases:
- Multiple campuses: Create separate pins for each campus
- Online scholarships: Use organization address if available, otherwise skip
- Verify addresses before geocoding to ensure accuracy
- Use consistent naming conventions
- Schools with fit issues: Still add them, but clearly mark fit problems

Remember:
- Add ALL schools and scholarships discussed, not just preferred options
- Clearly note any fit issues in the description field
- For schools with fit problems, explain the specific issues (financial, academic, etc.)
- For scholarships, prominently note amount and deadlines
- Ensure ALL links open in new tabs by setting target="_blank"
- NEVER output fake tool responses like "Tool X returned: {...}" - always use the proper tool format
- Avoid duplicating existing pins
- Use official addresses whenever possible
- Include preference matching data for pin styling
- Let the recommendations system handle detailed analysis
- Make only one tool call at a time and wait for results before proceeding

Your final output should consist only of a summary of the locations added in <answer> tags and should not duplicate or rehash any of the work you did in the analysis sections.
`;
