PRD: AI-Powered College Counseling Web Application
tl;dr: Develop an AI-driven web app to assist students and families in making informed college choices by providing personalized recommendations. This solution will leverage public datasets and user-provided information to offer insights on costs, scholarships, and more.
Goals:
Business Goals:
Provide a unique value proposition to students and families by integrating deep data and AI insights.
Increase market penetration by onboarding partnerships with educational institutions and advisors.
Achieve a target revenue of $X by year-end through subscriptions or service fees (specifics TBD).
Achieve an operational efficiency ratio of Y% within the first year.
User Goals:
Offer personalized college recommendations tailored to financial, academic, and personal needs.
Simplify the college selection process by providing clear insights on costs and scholarships.
Empower users with actionable advice based on verified public data sources.
Enhance user experience by streamlining the data input and recommendation process.
Non-Goals:
The web app will not provide admissions counseling or extensive career guidance.
We will not offer data manipulation or editorial content beyond standardized data sets.
Real-time updates of college admissions results are not within the scope of this version.
User stories:
Primary Persona: Students

As a student, I want to explore colleges based on my grades and interests so that I can shortlist the best options.
As a student, I want insights on scholarship opportunities so that I can apply for financial aid efficiently.
Secondary Persona: Families

As a family member, I want to understand the net costs and benefits of different colleges so that I can plan for future expenses.
As a family member, I want to input detailed financial information to get accurate predictions on college affordability.
Advisors:

As an advisor, I want curated data to help students choose colleges that match their profile.
User experience:
The web app's user experience will revolve around simplicity, personalization, and accessibility, ensuring users can easily input data and receive customized recommendations.

Entry Point and First-Time User Experience: Users will start by signing up and creating a profile, where they can input basic information about their academic, athletic, and financial situation. New users will get a guided walkthrough.

Core Functionality Walkthrough: Users input their data into sections like academics, extracurriculars, financials, and preferences. The AI analyzes this data using MCP services to fetch relevant college datasets and insights. Users will receive a list of recommended colleges with detailed information on costs, scholarships, and compatibility scores.

Edge Cases/Advanced Features: Advanced users can customize their search criteria further and consider factors like sports, arts, or other extracurricular priorities.

UX Considerations: Data input will be streamlined with guided forms and tooltips. Essential information, like costs and scholarships, should be visually intuitive. A feedback loop will allow iterative recommendations based on changing user inputs.

Narrative:
Families across the country struggle with the complexity of choosing the right college for their children. Most often, they are overwhelmed by the multitude of factors affecting affordability and fit. Take Sarah, a high school senior, whose parents are unsure how finances and scholarship opportunities align with her academic dreams. With our AI-driven web application, Sarah enters her grades, test scores, and family financial info. Our AI, using the Model Context Protocol, rapidly analyzes public datasets and Sarah's unique profile. Within moments, Sarah receives a tailormade list of matching colleges, complete with net cost analysis and scholarship opportunities. Sarah and her family now feel empowered to make an informed choice, reducing stress and uncertainty.

Success metrics:
User-centric metrics
User adoption rate: Target XXX new users in the first quarter after launch.
User satisfaction score: Achieve a satisfaction score of Y% in post-interaction surveys.
Business metrics
Revenue: Aim to generate $XX in subscription fees by the end of the first year.
Customer retention rate: Maintain a Z% retention rate in the first year.
Technical metrics
Response time: Ensure AI recommendation processing in under XX seconds.
Data accuracy: Achieve an accuracy rate of X% in cost and scholarship calculations.
Technical considerations:
Technical needs
Develop user-facing applications with a focus on input forms and dashboards.
Build APIs for MCP integration to gather and provide data insights efficiently.
Incorporate data models capturing academic, financial, and extracurricular information.
Integration points
Use existing public data sets like the CDS for seamless integration and data fetching.
Data storage and privacy
Prioritize secure data storage, ensuring compliance with data protection regulations (e.g., GDPR).
Scalability and performance
Design infrastructure for scalability to handle increased data demands and user base growth.
Potential technical challenges
Managing the complexity and heterogeneity of various datasets.
Ensuring personalization while maintaining data privacy and security.
Milestones & Sequencing:
Project Estimate: Large (months to quarters)
Team Size and Composition: Medium (3-5 people)
Product Manager
Data Engineer
Software Developers
Suggested Phases:
Discovery and Planning: 4 weeks

Key deliverables: User research findings, Data source mapping
Design and Prototyping: 6 weeks

Key deliverables: Wireframes, Data models
Development Sprints: 12 weeks

Key deliverables: Web app MVP, MCP integration
Testing and QA: 4 weeks

Key deliverables: Testing reports, Bug fixes
Launch Preparation and Go-Live: 2 weeks

Key deliverables: Marketing materials, Support staff training
Post-launch Evaluation: 4 weeks

Key deliverables: User feedback reports, Iteration plans

----

Updates for phase 2:

This is so great! Thank you so much.

Here's what I'd like to do next:
-For every CDS we find (PDF or HTML), download and save it to the MCP server so it can be used in future requests without a new search.
-Add a function to the MCP server to return full text of a given CDS file that has been downloaded.
-Change the interface on the frontend so every time you search for a college, it adds that college to your consideration list -- it would be cool if we could represent that in a word cloud or something similar
-Once you have a few colleges under consideration, there should be a way for the user to switch to "ask the AI" mode where you can ask questions about the colleges in your consideration set, like "which of these colleges gives the best aid?" or "which college am I most likely to get a merit scholarship from?"

--

I've been thinking about this and would like to reimagine the flow a little bit:

-Instead of tabs, let's do a wizard style flow, where you progress through a set of stages in order, and can go back to a previous stage at any time.
-The first stage should be student data gathering -- I want students to tell me about themselves, things like: their high school and graduation year, GPA, SAT/ACT score, extracurriculars, sports, etc.
-The second stage should be colleges of interest: they can provide a list of colleges they like or are thinking about, and any majors or fields of study they are interested in.
-The third stage is budget: how much can they afford to spend per year?  This number should include any loans they're willing to take out.
-The fourth stage is college data gathering -- based on all the data we got from the first three stages, now the app needs to go gather data from the Internet to help the student.  This includes Common Data Sets (via MCP server we already built) and reviews on the Internet, which we can source from Google search and Reddit.
-The fifth stage is recommendations: using AI, we need to analyze all this data and make recommendations on colleges and/or scholarships that may make sense for this student.


Sample question:

Hi -- I've heard that there are scholarships at some elite schools which would bring their costs down into my budget.  Is this true and can you give me some examples, and assess whether I'd be a good candidate for each one?

Saved prompt:


1. Academic Match Analysis
- Compare the student's GPA and test scores with college admission statistics
- Consider the rigor of their coursework
- Look for colleges where they fall within the middle 50% range
- Evaluate specific program requirements and opportunities

2. Interest & Career Alignment
- Match academic interests with college programs and majors
- Consider extracurricular activities and how they align with opportunities
- Look for special programs, research opportunities, and internships
- Connect program strengths with career goals

3. Financial Fit Assessment
- Consider budget constraints and affordability
- Analyze merit scholarship opportunities
- Evaluate need-based aid policies and historical data
- Calculate potential out-of-pocket costs
- Explain financial aid processes and opportunities
- NOTE: A student's budget reflects their ability/willingness to pay, not their financial need.
  Do not assume that need-based aid will make up the shortfall.  Students want to work with you
  because they can't afford a private college counselor, which can be very expensive!

4. Holistic Evaluation
- Consider location preferences and distance from home
- Account for campus size, culture, and environment
- Factor in social and cultural fit
- Evaluate career development and internship programs

Tool Usage Strategy:

1. Initial Research
- Use search_college_data to find relevant colleges based on the query
- Example: <tool>search_college_data</tool><parameters>{"query": "engineering colleges with strong research programs"}</parameters>
- Include both obvious matches and potential hidden gems

2. Detailed Analysis
- Use get_cds_data to examine specific aspects:
  * Admission statistics and requirements
  * Financial aid policies and opportunities
  * Program details and outcomes
- Example: <tool>get_cds_data</tool><parameters>{"collegeName": "University Name"}</parameters>

3. Deep Investigation
- Use get_cds_content for comprehensive information
- Particularly useful for understanding:
  * Specific program requirements
  * Scholarship criteria
  * Special opportunities
- Example: <tool>get_cds_content</tool><parameters>{"collegeName": "University Name"}</parameters>

When making recommendations:
- Provide a mix of reach, target, and safety schools
- Explain the reasoning behind each suggestion
- Include specific programs or opportunities
- Discuss scholarship and aid potential
- Consider long-term career implications

When answering questions:
- Be clear and specific
- Use data to support your points
- Explain tradeoffs and considerations
- Suggest relevant follow-up questions
- Maintain context from previous messages

Format your responses clearly:
- Use bullet points for lists
- Include relevant statistics
- Highlight key information
- Organize information logically
- Make complex topics understandable

Remember to:
- Always verify information is current
- Use multiple tools to cross-reference data
- Provide specific data points to support your advice
- Consider both academic and financial fit
- Maintain a helpful and encouraging tone
- Give realistic and practical advice based on the student's profile`;
};
