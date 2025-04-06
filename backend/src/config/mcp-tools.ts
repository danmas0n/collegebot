export const toolServerMap: Record<string, string> = {
  // College data server tools
  search_college_data: 'college-data',
  get_cds_data: 'college-data',
  
  // Fetch server tools
  fetch_markdown: 'fetch',

  // Student data server tools (now handled through Firestore)
  geocode: 'student-data',
  create_map_location: 'student-data',
  get_map_locations: 'student-data',
  clear_map_locations: 'student-data'
};
