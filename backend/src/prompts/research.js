// Instructions for Claude on organizing research data using memory tools

export const researchInstructions = `
When you find research data about colleges or scholarships, follow these steps to organize it in the knowledge graph:

1. For each college or scholarship you find information about:

   a. First create or update the entity:
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

   b. Create relations to connect the research:
      Use the create_relations tool:
      {
        "relations": [{
          "from": "College Name",
          "to": "Research Topic",
          "relationType": "has_information_about"
        }]
      }

2. When organizing Common Data Set (CDS) files:
   - Create an entity for the CDS document
   - Extract key statistics as observations
   - Link it to the college with "has_cds_data" relation
   - Include the year in observations

3. For scholarship information:
   - Create scholarship entities with eligibility criteria as observations
   - Link to relevant colleges with "offers_scholarship" relation
   - Include deadline and amount information

4. For general research:
   - Create topic entities for major themes (e.g., "Financial Aid", "Campus Life")
   - Link research to both colleges and topics
   - Use clear, active voice relation types

Remember:
- Each observation should be atomic (one fact per observation)
- Use consistent naming for entities and relation types
- Include source URLs and timestamps in observations
- Organize information hierarchically through relations
`;
