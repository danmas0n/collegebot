// Map tools to their MCP servers
export const toolServerMap = {
  // College data tools
  'search_college_data': 'college-data',
  'get_cds_data': 'college-data',
  
  // Student data tools
  'get_students': 'student-data',
  'save_student': 'student-data',
  'delete_student': 'student-data',
  'get_chats': 'student-data',
  'save_chat': 'student-data',
  'delete_chat': 'student-data',
  'mark_chat_processed': 'student-data',
  
  // Memory/Knowledge graph tools
  'create_entities': 'memory',
  'create_relations': 'memory',
  'add_observations': 'memory',
  'delete_entities': 'memory',
  'delete_observations': 'memory',
  'delete_relations': 'memory',
  'read_graph': 'memory',
  'search_nodes': 'memory',
  'open_nodes': 'memory'
};
