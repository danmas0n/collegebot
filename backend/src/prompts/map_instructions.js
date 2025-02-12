// Instructions for Claude on adding locations to the map

export const mapInstructions = `
Your primary task is to extract and add location pins to the map. Keep it simple and focused:

1. Check Current Map
   - Review existing pins to avoid duplicates
   - Note what's already mapped

2. Extract Locations and Links
   - Look for mentions of:
     * College names and addresses
     * Scholarship organization locations
     * Campus locations and satellite campuses
   - For each location, extract:
     * Name
     * Address
     * Basic type (college or scholarship)
     * Essential website/URL
   - Also extract any reference links discussed in the conversation:
     * Look for links collected during recommendations
     * Include relevant links in the location's metadata
     * Organize links by category (admissions, financial, etc.)

3. Add Each Location:

   a. Geocode the address:
      {
        "address": "College or organization address",
        "name": "Location name"
      }

   b. Create map pin:
      {
        "studentId": "[Current student ID]",
        "location": {
          "id": "[type]-[name-slug]-[timestamp]",
          "type": "college" | "scholarship",
          "name": "Location name",
          "latitude": number,
          "longitude": number,
          "metadata": {
            "website": "URL",
            "description": "Brief description",
            "address": "Full address",
            "matchesPreferences": {
              "region": boolean,
              "state": boolean,
              "distance": boolean,
              "setting": boolean
            },
            "referenceLinks": [
              {
                "url": "URL",
                "title": "Link title",
                "category": "admissions" | "financial" | "academic" | "campus" | "career" | "research" | "application" | "student-life" | "social",
                "source": "official" | "semi-official" | "unofficial"
              }
            ],
            // For colleges
            "reason": "Brief reason for inclusion",
            // For scholarships
            "amount": number,
            "deadline": "YYYY-MM-DD",
            "applicationUrl": "URL"
          }
        }
      }

4. Special Cases:
   - Multiple campuses: Create separate pins for each
   - Online scholarships: Use organization address if available, otherwise skip
   - Verify addresses before geocoding
   - Use consistent naming

Remember:
- Keep it simple - just add pins with essential info
- Avoid duplicates
- Use official addresses
- Basic preference matching for pin styling
- Let the recommendations system handle detailed analysis
`;
