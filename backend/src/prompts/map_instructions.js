// Instructions for Claude on extracting and geocoding location data

export const mapInstructions = `
When analyzing conversations to extract location data for the map, follow these steps:

1. Review Current Map State and Student Preferences
   - Examine the provided map state to understand existing locations
   - Check student's location preferences in collegeInterests.locationPreferences:
     * Preferred regions and states
     * Minimum and maximum distance from home
     * Urban/suburban/rural preferences
   - Look for:
     * What colleges and scholarships are already mapped
     * What location metadata is already stored
     * Which locations match student preferences
   - Avoid creating duplicate locations
   - Prioritize locations that match student preferences

2. Extract New Information
   - Look for mentions of:
     * College names and addresses
     * Scholarship organizations and their locations
     * Campus locations and landmarks
     * Satellite campuses or extension centers
     * Physical locations where scholarships can be applied
   - For each location, calculate and note:
     * Distance from student's home location
     * Whether it falls within preferred regions/states
     * Urban/suburban/rural classification
   - Collect useful reference links:
     Official Sources:
     * College/scholarship websites
     * Program-specific pages
     * Virtual tour links
     * Application portals
     * Financial aid/scholarship pages
     * Student life/campus culture pages
     * Research opportunities
     * Career outcomes data
     
     Student & Community Sources:
     * Reddit threads and subreddits
     * YouTube student vlogs
     * Student Instagram highlights
     * Twitter discussions
     * College Confidential threads
     * Student blogs and experiences
     * Local community forums
     * Alumni network discussions

3. For each new location:

   a. Geocode the location using the geocode tool:
      {
        "address": "College or organization address",
        "name": "Location name"
      }

   b. Create map location with the create_map_location tool:
      {
        "studentId": "[Current student ID]",
        "location": {
          "id": "[type]-[name-slug]-[timestamp]", // e.g., "college-mit-1737601379887"
          "type": "college" | "scholarship",
          "name": "Location name",
          "latitude": number,
          "longitude": number,
          "metadata": {
            "website": "URL", // College website or scholarship application URL
            "description": "Brief description",
            "address": "Full address",
            "distanceFromHome": number, // Miles from student's home
            "matchesPreferences": {
              "region": boolean,
              "state": boolean,
              "distance": boolean,
              "setting": boolean
            },
            "referenceLinks": [
              {
                "url": "URL",
                "title": "Link title/description",
                "category": "admissions" | "financial" | "academic" | "campus" | "career" | "research" | "application" | "student-life" | "social",
                "source": "official" | "semi-official" | "unofficial",
                "platform": "website" | "reddit" | "youtube" | "twitter" | "instagram" | "linkedin" | "blog" | "news" | "other",
                "notes": "Optional brief notes about what's useful on this page",
                "dateFound": "YYYY-MM-DD",
                "credibilityNotes": "Optional notes about source credibility/relevance"
              }
            ],
            // For colleges
            "fitScore": number,
            "reason": "Fit description",
            // For scholarships
            "amount": number,
            "deadline": "YYYY-MM-DD",
            "eligibility": "Eligibility criteria",
            "applicationUrl": "URL", // Direct link to scholarship application if different from website
            "sponsorWebsite": "URL" // Website of the scholarship sponsor/organization
          }
        }
      }

4. Special Cases:
   a. For colleges with multiple campuses:
      - Create separate locations for each campus
      - Link them in metadata with a common institution ID
      - Include campus-specific information in metadata
      - Calculate preference matches for each campus separately
      - Collect both institution-wide and campus-specific reference links
      - Include student experiences specific to each campus

   b. For online-only scholarships:
      - Use the organization's physical address if available
      - If no physical address, skip mapping but store in student data
      - Include "online-only" flag in metadata
      - Focus on collecting application process and eligibility links
      - Include student success stories and experiences

   c. For scholarship deadlines:
      - Always use YYYY-MM-DD format
      - If multiple deadlines exist, use earliest upcoming deadline
      - Include additional deadline info in description
      - Collect links to deadline calendars and application timelines
      - Include student application experience posts

Remember:
- Always verify addresses before geocoding
- Include as much metadata as possible for rich info windows
- Use consistent naming conventions
- Include source URLs and timestamps in metadata
- Organize information hierarchically
- Prefer official addresses over general locations
- Consider student preferences when evaluating locations
- Categorize and annotate reference links clearly
- Balance official and unofficial sources:
  * Verify key information from official sources
  * Use student experiences to provide real-world context
  * Note the credibility and date of unofficial sources
  * Look for patterns in student feedback
  * Highlight particularly detailed or insightful posts
- Update existing locations with new relevant links when found
`;
