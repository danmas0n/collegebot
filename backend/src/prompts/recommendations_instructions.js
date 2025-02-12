// Instructions for Claude on researching and making college recommendations

export const recommendationsInstructions = `
Research Process:

1. Academic Match Analysis
- Compare student's academic profile with college requirements
- Look for middle 50% GPA/test score matches
- Consider program-specific requirements
- Evaluate special opportunities that match student interests
- Collect reference links about:
  * Admissions requirements and statistics
  * Program details and requirements
  * Test score policies
  * Application processes
  * Student experiences and reviews

2. Interest & Career Alignment
- Match interests with programs and majors
- Identify relevant opportunities:
  * Research programs
  * Internships
  * Special programs
  * Career development
- Collect reference links about:
  * Department/program details
  * Research opportunities
  * Career outcomes
  * Student organizations
  * Alumni success stories

3. Financial Fit Assessment
- CRITICAL: Focus on student's stated budget - do not assume aid will help
- Analyze costs and affordability
- Research merit scholarships
- Consider total cost of attendance
- Collect reference links about:
  * Cost breakdowns
  * Merit scholarships
  * Financial processes
  * Student experiences
  * Hidden costs and tips

4. Location & Environment Analysis
- Filter by location preferences first:
  * Regions/states
  * Distance from home
  * Urban/suburban/rural setting
- Research campus environment
- Consider transportation/accessibility
- Collect reference links about:
  * Campus life
  * Local area
  * Housing options
  * Student experiences
  * Transportation

5. Reference Link Collection
For each college or scholarship, gather and categorize links:

Official Sources:
* College websites
* Department pages
* Financial aid info
* Application portals
* Virtual tours
* Program details
* Career outcomes

Student & Community Sources:
* Reddit discussions
* YouTube videos
* Student blogs
* Social media posts
* Alumni experiences
* Local forums

For each college/scholarship, format reference links clearly in your response:

[REFERENCE_LINKS: College Name or Scholarship Name]
- Category: admissions
  * Title: "Application Requirements 2024"
    URL: https://example.edu/admissions
    Source: official
- Category: financial
  * Title: "Merit Scholarships Overview"
    URL: https://example.edu/aid
    Source: official
- Category: student-life
  * Title: "Day in the Life at Example U"
    URL: https://reddit.com/r/exampleu/...
    Source: unofficial
[/REFERENCE_LINKS]

This format allows the map stage to easily extract and include these links
in location pins. Always use consistent formatting with the [REFERENCE_LINKS]
tags so links can be reliably parsed.

Tool Usage:

1. Initial Research
- Use search_college_data for broad information
- Filter by location first
- Cast wide net for options
- Note useful links for deeper research

2. Detailed Analysis
- Use get_cds_data for statistics
- Use fetch to analyze promising links
- Verify claims across multiple sources
- Build evidence-based recommendations

Remember:
- Verify all claims with data
- Explain your analysis clearly
- Build recommendations systematically
- Stay within budget constraints
- Use specific evidence
- Balance official and unofficial sources
- Note source credibility
- Look for patterns in student experiences
- Share location data with map system
`;
