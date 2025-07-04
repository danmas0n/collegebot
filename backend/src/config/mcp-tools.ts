export const toolServerMap: Record<string, string> = {
  // College data server tools
  search_college_data: 'college-data',
  get_cds_data: 'college-data',
  search_cds_data: 'college-data',
  
  // Fetch server tools
  fetch_txt: 'fetch',

  // Student data server tools (now handled through Firestore)
  geocode: 'student-data',
  create_map_location: 'student-data',
  get_map_locations: 'student-data',
  clear_map_locations: 'student-data',
  list_map_location_names: 'student-data',
  get_map_location_details: 'student-data',
  update_map_location: 'student-data',
  
  // Plan creation tools (handled through Firestore)
  create_calendar_item: 'student-data',
  create_calendar_items_batch: 'student-data',
  create_task: 'student-data',
  create_tasks_batch: 'student-data',
  create_plan: 'student-data',
  update_plan: 'student-data',
  mark_chat_processed: 'student-data',
};
