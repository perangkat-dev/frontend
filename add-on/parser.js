/**
 * UserScript metadata parser for Simple User Script Manager
 * Parses only metadata without modifying source code
 */

/**
 * Parse UserScript metadata from source code
 * @param {string} source - Script source code
 * @returns {Object} Parsed result with metadata, source, valid, error
 */
export function parseScript(source) {
  const result = {
    metadata: {
      name: '',
      namespace: '',
      version: '',
      description: '',
      author: '',
      match: [],
      include: [],
      exclude: [],
      grant: [],
      require: [],
      resource: {},
      runAt: 'document-end'
    },
    source: source,
    valid: false,
    error: null
  };
  
  if (!source || typeof source !== 'string') {
    result.error = 'Invalid source: source must be a non-empty string';
    return result;
  }
  
  try {
    // Extract metadata block
    const metadataMatch = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!metadataMatch) {
      result.error = 'No UserScript metadata block found';
      return result;
    }
    
    const metadataBlock = metadataMatch[1];
    const lines = metadataBlock.split('\n');
    
    // Parse each line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Match @key value
      const match = trimmed.match(/^\/\/\s*@([a-zA-Z-]+)\s+(.*)$/);
      if (!match) continue;
      
      const key = match[1];
      const value = match[2].trim();
      
      // Handle different metadata keys
      switch (key) {
        case 'name':
          result.metadata.name = value;
          break;
          
        case 'namespace':
          result.metadata.namespace = value;
          break;
          
        case 'version':
          result.metadata.version = value;
          break;
          
        case 'description':
          result.metadata.description = value;
          break;
          
        case 'author':
          result.metadata.author = value;
          break;
          
        case 'match':
          if (value) {
            result.metadata.match.push(value);
          }
          break;
          
        case 'include':
          if (value) {
            result.metadata.include.push(value);
          }
          break;
          
        case 'exclude':
          if (value) {
            result.metadata.exclude.push(value);
          }
          break;
          
        case 'grant':
          if (value) {
            result.metadata.grant.push(value);
          }
          break;
          
        case 'require':
          if (value) {
            result.metadata.require.push(value);
          }
          break;
          
        case 'resource':
          if (value) {
            const resourceMatch = value.match(/^([^\s]+)\s+(.+)$/);
            if (resourceMatch) {
              result.metadata.resource[resourceMatch[1]] = resourceMatch[2];
            }
          }
          break;
          
        case 'run-at':
          const validRunAt = ['document-start', 'document-end', 'document-idle'];
          if (validRunAt.includes(value)) {
            result.metadata.runAt = value;
          } else {
            console.warn('Invalid run-at value:', value, '- using document-end');
          }
          break;
          
        default:
          // Ignore unknown metadata keys
          break;
      }
    }
    
    // Validate required fields
    if (!result.metadata.name) {
      result.error = 'Missing required @name metadata';
      return result;
    }
    
    // Set default namespace if not provided
    if (!result.metadata.namespace) {
      result.metadata.namespace = 'default';
    }
    
    // Ensure match and include arrays at least have something
    if (result.metadata.match.length === 0 && result.metadata.include.length === 0) {
      // If no match or include, script runs on all URLs
      // This is valid behavior for user scripts
      console.warn('No @match or @include specified, script will run on all URLs');
    }
    
    result.valid = true;
    result.error = null;
    
    return result;
    
  } catch (e) {
    result.error = `Error parsing metadata: ${e.message}`;
    console.error('Parser error:', e);
    return result;
  }
}