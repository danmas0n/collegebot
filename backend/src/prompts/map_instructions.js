// Instructions for Claude on extracting and geocoding location data

export const mapInstructions = `
When analyzing conversations to extract location data for the map, follow these steps:

1. Review Current Map State
   - Examine the provided map state to understand existing locations
   - Look for:
     * What colleges and scholarships are already mapped
     * What location metadata is already stored
   - Avoid creating duplicate locations

2. Extract New Information
   - Look for mentions of:
     * College names and addresses
     * Scholarship organizations and their locations
     * Campus locations and landmarks
     * Satellite campuses or extension centers
     * Physical locations where scholarships can be applied

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

   b. For online-only scholarships:
      - Use the organization's physical address if available
      - If no physical address, skip mapping but store in student data
      - Include "online-only" flag in metadata

   c. For scholarship deadlines:
      - Always use YYYY-MM-DD format
      - If multiple deadlines exist, use earliest upcoming deadline
      - Include additional deadline info in description

Remember:
- Always verify addresses before geocoding
- Include as much metadata as possible for rich info windows
- Use consistent naming conventions
- Include source URLs and timestamps in metadata
- Organize information hierarchically
- Prefer official addresses over general locations
`;
