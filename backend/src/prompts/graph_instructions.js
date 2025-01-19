// Instructions for Claude on organizing data in the knowledge graph

export const graphInstructions = `
When analyzing conversations to enrich the knowledge graph, follow these steps:

1. Review Current Graph State
   - Examine the provided graph state to understand existing entities and relationships
   - Look for:
     * What colleges and scholarships are already tracked
     * What relationships already exist
     * What observations are already recorded
   - Avoid creating duplicate entities or redundant relationships

2. Extract New Information
   - Look for mentions of:
     * Colleges and their characteristics
     * Scholarships and their requirements
     * Academic programs or majors
     * Student preferences and reactions
     * Important dates or deadlines
     * Specific observations about fit

3. Organize New Information

4. For each new piece of information:

   a. Check if the entity exists, then create or update:
      Use the create_entities tool:
      {
        "entities": [{
          "name": "College Name",
          "entityType": "college", // or "scholarship"
          "observations": [
            // Convert research into discrete observations
            "Source: [URL]",
            "Type: [CDS/Website/Article]",
            "Summary: [Brief summary]",
            // Key data points as individual observations
            "Admission Rate: 25%",
            "Average SAT: 1400",
            etc.
          ]
        }]
      }

   b. Create meaningful relations:
      Use the create_relations tool:
      {
        "relations": [{
          "from": "College Name",
          "to": "Research Topic",
          "relationType": "has_information_about"
        }]
      }

5. Special Cases:
   a. When organizing Common Data Set (CDS) files:
      - Create an entity for the CDS document
      - Extract key statistics as observations
      - Link it to the college with "has_cds_data" relation
      - Include the year in observations

   b. For scholarship information:
      - Create scholarship entities with eligibility criteria as observations
      - Link to relevant colleges with "offers_scholarship" relation
      - Include deadline and amount information

   c. For student preferences:
      - Add observations to the student entity about preferences
      - Create "prefers" or "interested_in" relations to relevant entities
      - Note any strong positive or negative reactions

   d. For general topics:
      - Create topic entities for major themes (e.g., "Financial Aid", "Campus Life")
      - Link research to both colleges and topics
      - Use clear, active voice relation types

Remember:
- Each observation should be atomic (one fact per observation)
- Use consistent naming for entities and relation types
- Include source URLs and timestamps in observations
- Organize information hierarchically through relations
`;
